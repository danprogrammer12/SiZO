const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule }        = require('firebase-functions/v2/scheduler')
const { initializeApp }     = require('firebase-admin/app')
const { getAuth }           = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

const auth = getAuth()
const db   = getFirestore()

// ─────────────────────────────────────────────────────────────
// createTenant — onboarding completo de un tenant nuevo
// ─────────────────────────────────────────────────────────────
exports.createTenant = onCall(async (request) => {
  const { tenantNombre, nombreCorto, tipo, plan, adminNombre, adminEmail, adminPassword } = request.data

  if (!tenantNombre || !adminEmail || !adminPassword) {
    throw new HttpsError('invalid-argument', 'Faltan campos requeridos')
  }

  // 1. Crear usuario ADMIN en Firebase Auth
  let userRecord
  try {
    userRecord = await auth.createUser({
      email:       adminEmail,
      password:    adminPassword,
      displayName: adminNombre,
    })
  } catch (err) {
    throw new HttpsError('already-exists', `Error al crear usuario: ${err.message}`)
  }

  // 2. Crear documento tenant en Firestore
  const tenantRef = db.collection('tenants').doc()
  const tenantId  = tenantRef.id
  const now       = FieldValue.serverTimestamp()

  await tenantRef.set({
    id:          tenantId,
    nombre:      tenantNombre,
    nombreCorto: nombreCorto || tenantNombre,
    tipo:        tipo || 'consultora',
    plan:        plan || 'starter',
    activo:      true,
    trialEnds:   null,
    logoPath:    null,
    colorPrimario: null,
    email:       adminEmail,
    tel:         null,
    ciudad:      null,
    creadoEn:    now,
    updatedAt:   now,
    updatedBy:   userRecord.uid,
    adminUid:    userRecord.uid,
  })

  // 3. Setear Custom Claims
  await auth.setCustomUserClaims(userRecord.uid, {
    tenantId,
    role:       'ADMIN',
    empresasIds: [],
  })

  // 4. Crear documento usuario en Firestore
  await db.doc(`tenants/${tenantId}/usuarios/${userRecord.uid}`).set({
    uid:         userRecord.uid,
    nombre:      adminNombre,
    email:       adminEmail.toLowerCase(),
    rol:         'ADMIN',
    activo:      true,
    empresasIds: [],
    tel:         null,
    tel2:        null,
    bday:        null,
    linkedin:    null,
    ciudad:      null,
    ultimoAcceso: null,
    creadoEn:    now,
    updatedAt:   now,
    updatedBy:   userRecord.uid,
    creadoPor:   userRecord.uid,
    deletedAt:   null,
  })

  return { tenantId, uid: userRecord.uid }
})

// ─────────────────────────────────────────────────────────────
// createUser — crear usuario dentro de un tenant (ADMIN only)
// ─────────────────────────────────────────────────────────────
exports.createUser = onCall(async (request) => {
  const caller = request.auth
  if (!caller || caller.token.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Solo ADMIN puede crear usuarios')
  }

  const { nombre, email, password, rol, empresasIds = [] } = request.data
  const tenantId = caller.token.tenantId

  if (!nombre || !email || !password || !rol) {
    throw new HttpsError('invalid-argument', 'Faltan campos requeridos')
  }

  if (!['ADMIN', 'ASESOR', 'CONSULTA'].includes(rol)) {
    throw new HttpsError('invalid-argument', 'Rol inválido')
  }

  if (empresasIds.length > 35) {
    throw new HttpsError('invalid-argument', 'Máximo 35 empresas por usuario (límite Custom Claims)')
  }

  let userRecord
  try {
    userRecord = await auth.createUser({ email, password, displayName: nombre })
  } catch (err) {
    throw new HttpsError('already-exists', `Error al crear usuario: ${err.message}`)
  }

  await auth.setCustomUserClaims(userRecord.uid, { tenantId, role: rol, empresasIds })

  const now = FieldValue.serverTimestamp()
  await db.doc(`tenants/${tenantId}/usuarios/${userRecord.uid}`).set({
    uid:         userRecord.uid,
    nombre,
    email:       email.toLowerCase(),
    rol,
    activo:      true,
    empresasIds,
    tel:         null,
    tel2:        null,
    bday:        null,
    linkedin:    null,
    ciudad:      null,
    ultimoAcceso: null,
    creadoEn:    now,
    updatedAt:   now,
    updatedBy:   caller.uid,
    creadoPor:   caller.uid,
    deletedAt:   null,
  })

  return { uid: userRecord.uid }
})

// ─────────────────────────────────────────────────────────────
// deactivateUser — desactivar usuario (ADMIN only)
// ─────────────────────────────────────────────────────────────
exports.deactivateUser = onCall(async (request) => {
  const caller = request.auth
  if (!caller || caller.token.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Solo ADMIN puede desactivar usuarios')
  }

  const { userId } = request.data
  const tenantId   = caller.token.tenantId

  await auth.revokeRefreshTokens(userId)
  await auth.updateUser(userId, { disabled: true })

  await db.doc(`tenants/${tenantId}/usuarios/${userId}`).update({
    activo:    false,
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// updateUserEmpresas — reasignar empresas de un ASESOR (ADMIN only)
// ─────────────────────────────────────────────────────────────
exports.updateUserEmpresas = onCall(async (request) => {
  const caller = request.auth
  if (!caller || caller.token.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Solo ADMIN puede reasignar empresas')
  }

  const { userId, empresasIds } = request.data
  const tenantId = caller.token.tenantId

  if (!Array.isArray(empresasIds)) {
    throw new HttpsError('invalid-argument', 'empresasIds debe ser un array')
  }

  if (empresasIds.length > 35) {
    throw new HttpsError('invalid-argument', 'Máximo 35 empresas por usuario')
  }

  const userRecord = await auth.getUser(userId)
  const currentClaims = userRecord.customClaims || {}

  await auth.setCustomUserClaims(userId, { ...currentClaims, empresasIds })
  await auth.revokeRefreshTokens(userId)

  await db.doc(`tenants/${tenantId}/usuarios/${userId}`).update({
    empresasIds,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// scheduledUpdateAccionesVencidas — cron diario a las 00:15 Colombia
// ─────────────────────────────────────────────────────────────
exports.scheduledUpdateAccionesVencidas = onSchedule(
  { schedule: '15 5 * * *', timeZone: 'America/Bogota' },
  async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const snap = await db.collectionGroup('acciones')
      .where('activo', '==', true)
      .where('estado', 'in', ['abierta', 'en_progreso'])
      .where('fechaLimite', '<', hoy)
      .get()

    if (snap.empty) {
      console.log('scheduledUpdateAccionesVencidas: sin acciones que actualizar')
      return
    }

    const batch = db.batch()
    snap.docs.forEach(d => {
      batch.update(d.ref, {
        estado:    'vencida',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'system',
      })
    })

    await batch.commit()
    console.log(`scheduledUpdateAccionesVencidas: ${snap.size} acciones marcadas como vencidas`)
  }
)

// ─────────────────────────────────────────────────────────────
// scheduledContratoAlerts — cron diario a las 08:00 Colombia
// ─────────────────────────────────────────────────────────────
exports.scheduledContratoAlerts = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'America/Bogota' },
  async () => {
    const hoy     = new Date()
    const en30    = new Date(Date.now() + 30 * 864e5)

    const snap = await db.collectionGroup('empresas')
      .where('activa', '==', true)
      .where('contratoFin', '>=', hoy.toISOString().slice(0, 10))
      .where('contratoFin', '<=', en30.toISOString().slice(0, 10))
      .get()

    if (snap.empty) return

    snap.docs.forEach(d => {
      const e = d.data()
      console.log(`Contrato próximo a vencer: ${e.nombre} — ${e.contratoFin}`)
      // V2: enviar email al ADMIN del tenant
    })
  }
)
