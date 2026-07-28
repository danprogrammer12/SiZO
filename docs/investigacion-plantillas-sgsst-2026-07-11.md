# Plantillas/Formatos oficiales SG-SST para Colombia — Investigación para SIZO
Fecha: 2026-07-11

## 1. Documentación general del SG-SST

| Formato | Para qué sirve / Normativa | Fuente oficial |
|---|---|---|
| **Política de Seguridad y Salud en el Trabajo** | Documento firmado por el empleador (representante legal), fecha, alcance, compromiso con normativa vigente. Exigido por Dec. 1072/2015 Art. 2.2.4.6.5 y Res. 0312/2019. | Anexo Técnico Res. 0312/2019 (MinTrabajo); plantillas ARL (Sura, Positiva, Colmena) |
| **Objetivos del SG-SST** | Metas medibles alineadas a la política, coherentes con la matriz de riesgos. | Dec. 1072/2015 Art. 2.2.4.6.16 |
| **Matriz de requisitos legales** | Listado actualizado de normas SST aplicables (leyes, decretos, resoluciones), con columna de cumplimiento/evidencia. | Dec. 1072/2015 Art. 2.2.4.6.8; plantillas ARL |
| **Manual/Descripción del SG-SST** | Documento marco que describe la estructura del sistema, roles y responsabilidades. | Res. 0312/2019 Anexo Técnico |

**Campos típicos:** id, nombre_documento, versión, fecha_aprobación, fecha_vigencia, responsable, archivo_adjunto.

**Gap en SIZO:** No existe módulo de "documentación general" (política, objetivos, requisitos legales). Candidato porque `archivos.js` solo gestiona PDFs firmados genéricos, no un checklist estructurado de documentos obligatorios con estado de vigencia.

## 2. Identificación de peligros y valoración de riesgos (Matriz IPVR / GTC 45)

| Formato | Para qué sirve | Fuente |
|---|---|---|
| **Matriz de Identificación de Peligros, Evaluación y Valoración de Riesgos (IPEVR)** | Metodología GTC 45 (ICONTEC) — no obligatoria por decreto, pero estándar de facto exigido por inspectores MinTrabajo/ARL, según Dec. 1072/2015 Art. 2.2.4.6.15. Actualización anual o ante accidente grave/mortal. | ICONTEC (GTC 45:2012 — de pago); plantillas Excel libres de ARL y universidades (ej. Uniandes `FOR-45-1-05-01`) |

**Campos típicos:** proceso, zona/lugar, actividad (rutinaria/no rutinaria), tarea, peligro (físico, químico, biológico, biomecánico, psicosocial...), fuente del peligro, efectos posibles, controles existentes (fuente/medio/individuo), nivel de deficiencia, nivel de exposición, nivel de probabilidad, nivel de consecuencia, nivel de riesgo, interpretación, aceptabilidad, controles propuestos, número de expuestos, peor consecuencia.

**Gap en SIZO:** No hay módulo dedicado. Muy solicitada por ARL/auditores — valiosa de digitalizar (cálculo automático de nivel de riesgo).

## 3. Gestión de indicadores (Resolución 0312/2019)

Ya cubierto en gran parte por `modules/indicadores.js` (IFA, IFM, ISA con base HHT 240.000). Complementarios exigidos:

| Indicador | Fórmula | Fuente |
|---|---|---|
| Frecuencia de accidentalidad (FA) | (N° AT / N° trabajadores) × 100 | Res. 0312/2019 |
| Severidad de accidentalidad | Días perdidos/cargados / N° trabajadores × K | Res. 0312/2019 |
| Proporción de AT mortales | (N° AT mortales / N° total AT) × 100 | Res. 0312/2019 |
| Prevalencia de enfermedad laboral | (Casos nuevos + antiguos EL / Promedio trabajadores) × 100.000 | Res. 0312/2019 |
| Incidencia de enfermedad laboral | (Casos nuevos EL / Promedio trabajadores) × 100.000 | Res. 0312/2019 |
| Ausentismo por causa médica | (Días de ausencia por incapacidad / Días programados) × 100 | Res. 0312/2019 |

**Nota importante:** Res. 0312/2019 usa **factor 100.000** para prevalencia/incidencia de enfermedad laboral — distinto al factor 240.000 (HHT, Dec. 1072) que SIZO ya usa para IFA/IFM/ISA. Revisar `calcular-indicadores.js` para confirmar que ambos factores no se confundan.

**Gap:** faltan indicadores de estructura/proceso (% cumplimiento plan anual, cobertura capacitación) y prevalencia/incidencia con factor 100.000.

## 4. Investigación de accidentes e incidentes de trabajo

| Formato | Para qué sirve | Fuente |
|---|---|---|
| **FURAT** | Reporte del presunto AT a ARL/EPS en 2 días hábiles. | Cada ARL tiene su propio formulario (Sura: `arlsura.com/formularios/furat.xls`, Positiva, Colmena, Axa Colpatria...) |
| **Formato de Investigación de AT/Incidente (Res. 1401/2007)** | Investigación de causas raíz en 15 días; debe incluir variables del informe de AT (Res. 156/2005). | Res. 1401/2007; formatos de cada ARL |

**Campos FURAT:** datos del trabajador (cédula, cargo, antigüedad), datos del empleador (NIT, actividad económica, ARL), fecha/hora/lugar, descripción, parte del cuerpo afectada, tipo de lesión, agente del accidente, testigos.

**Campos Investigación 1401:** clasificación (accidente/incidente), datos generales, descripción, causas inmediatas (actos/condiciones subestándar), causas básicas (factores personales y de trabajo), análisis de causalidad, medidas de control, responsable, fecha de cierre, firmas del equipo investigador.

**Gap parcial en SIZO:** verificar si `accidentes.js` captura el desglose de causas inmediatas/básicas (Res. 1401) o solo el registro del evento — si es lo segundo, gap de alto impacto legal (plazo de 15 días).

## 5. Ausentismo laboral

Sin formato único oficial — cada ARL propone plantilla propia. **Campos típicos:** trabajador, cargo, tipo de ausencia (EG, ET, AT, EL, licencia), fecha inicio/fin, días, diagnóstico/CIE-10, entidad que expide incapacidad, radicado.

**Cobertura SIZO:** ya existe `modules/ausentismo.js`. Validar si captura CIE-10 y tipo de incapacidad para alimentar prevalencia/incidencia de enfermedad laboral (punto 3).

## 6. Inspecciones de seguridad

| Formato | Fuente |
|---|---|
| Inspección planeada (locativa, orden y aseo, ergonómica) | Dec. 1072/2015 Art. 2.2.4.6.8; plantillas ARL (`GTH-F-50`) |
| Inspección de extintores (NTC 2885/NFPA 10) | Plantillas ARL / SafetyCulture |
| Inspección de botiquines | Plantillas ARL |

**Campos típicos:** fecha, área/zona, elemento inspeccionado, ítem de chequeo, cumple/no cumple, observación, evidencia fotográfica, responsable, acción correctiva, fecha próxima inspección.

**Cobertura SIZO:** `modules/inspecciones.js` ya existe. Gap posible: subtipos (extintores/botiquines) con periodicidad configurable y alertas de vencimiento.

## 7. Capacitación, inducción y reinducción

| Formato | Fuente |
|---|---|
| Matriz de capacitación anual | Plantillas ARL/institucionales |
| Programa de inducción y reinducción SST (Dec. 1072 Art. 2.2.4.6.11) | MinVivienda `GTH-F-54`, ARL |
| Formato de asistencia | Sin formato único |
| Evaluación de impacto de capacitación | Plantillas ARL |

**Campos típicos:** tema, tipo (inducción/reinducción/específica), fecha, duración, facilitador, participantes (cédula, nombre, cargo, firma), evaluación, evidencia.

**Cobertura SIZO:** `modules/capacitacion.js` ya existe — validar si distingue inducción/reinducción/específica y controla periodicidad de reinducción.

## 8. Plan de trabajo anual del SG-SST

Ya cubierto por `modules/plan.js`. Exigido por Dec. 1072/2015 Art. 2.2.4.6.8 y Res. 0312/2019 estándar 1.1.3/1.1.4.

**Campos típicos:** actividad, objetivo, responsable, recursos, fecha inicio/fin, % avance, estado, evidencia.

## 9. Auditoría interna del SG-SST

| Formato | Fuente |
|---|---|
| Programa de auditoría anual (participación COPASST/Vigía, auditor independiente) | Dec. 1072/2015 Art. 2.2.4.6.29-31 |
| Formato de hallazgos | Plantillas ARL |
| Plan de acción de auditoría | Plantillas ARL |

**Campos típicos:** criterio auditado (estándar Res. 0312), hallazgo, tipo (NC mayor/menor/observación), evidencia, causa raíz, acción correctiva, responsable, fecha compromiso, estado, fecha cierre.

**Cobertura SIZO:** `modules/auditoria.js` ya existe — validar trazabilidad hallazgo → `modules/acciones.js` → cierre.

## 10. Acciones correctivas y preventivas

Ya cubierto por `modules/acciones.js`. **Campos típicos:** origen (accidente, inspección, auditoría, PQRS), descripción, análisis de causa (5 porqués/Ishikawa), tipo, responsable, fecha compromiso, seguimiento, eficacia, fecha cierre.

## 11. Casos médicos / condiciones de salud

| Formato | Fuente |
|---|---|
| Perfil sociodemográfico | Dec. 1072/2015 Art. 2.2.4.6.16 |
| Diagnóstico de condiciones de salud | Guías ARL / SVE |
| Reporte de condiciones de salud (exámenes ocupacionales) | Res. 2346/2007 |

**Cobertura SIZO:** `modules/casos.js` ya existe con RLS restringido a ADMIN (correcto por confidencialidad). Gap: validar si incluye perfil sociodemográfico agregado como reporte consolidado (frecuente en auditorías).

## 12. Elementos de protección personal (EPP)

| Formato | Fuente |
|---|---|
| Matriz de EPP (cruza cargo/peligro con EPP, norma técnica, frecuencia reposición) | Plantillas ARL |
| Formato de entrega individual de EPP (firmado, Dec. 1072 Art. 2.2.4.6.24) | Plantillas ARL (Rama Judicial `F-SST-11`) |

**Gap en SIZO:** No existe módulo. Gap claro y frecuentemente auditado (evidencia de entrega firmada).

## 13. Documentos legales de firma (actas COPASST, comité de convivencia)

| Formato | Fuente |
|---|---|
| Acta de conformación de COPASST (Res. 2013/1986) | Plantillas ARL/institucionales |
| Acta de reunión COPASST (mensual) | Plantillas institucionales |
| Acta de comité de convivencia laboral (Res. 652/2012, 1356/2012) | Plantillas institucionales |

**Cobertura SIZO:** `modules/archivos.js` (firma PDF con pdf-lib) sirve como mecanismo genérico, pero no hay módulo estructurado de "actas" con periodicidad y trazabilidad de comités — complementario a archivos.js, no reemplazo.

---

## Resumen priorizado — los formatos más valiosos de digitalizar primero

Evaluando qué NO está cubierto (o solo parcialmente) por los módulos actuales:

1. **Matriz IPVR/GTC 45** — GAP TOTAL. Base de todo el sistema (de ella derivan EPP, capacitación, inspecciones). Máxima prioridad.
2. **Matriz de EPP + entrega individual firmada** — GAP TOTAL. Muy exigido en auditorías, evidencia legal.
3. **Investigación de accidentes (Res. 1401)** — verificar si `accidentes.js` cubre causas inmediatas/básicas o solo el registro del evento.
4. **Documentación general del SG-SST** (política, objetivos, requisitos legales, con vigencia/versión) — GAP TOTAL, lo primero que pide un auditor.
5. **Actas COPASST / comité de convivencia** con periodicidad y trazabilidad — gap parcial.
6. **Perfil sociodemográfico consolidado** — verificar si `casos.js` lo reporta agregado.
7. **Indicadores de prevalencia/incidencia de enfermedad laboral (factor 100.000)** — verificar que no se mezcle con el factor 240.000.
8. **Programa de auditoría con cierre de hallazgos enlazado a acciones** — verificar trazabilidad `auditoria.js` → `acciones.js`.

Los ítems 1, 2 y 4 son de mayor prioridad: módulos completamente inexistentes y pilares del cumplimiento legal y de la arquitectura de datos (la matriz de peligros alimenta EPP, capacitación e indicadores).

## Fuentes consultadas

- [Verifty — Matriz IPEVR GTC 45](https://www.verifty.com/recursos/matriz-ipevr-gtc-45-excel)
- [Zandersas — Guía GTC 45](https://zandersas.com/seguridad-y-salud-trabajo/guia-gtc-45-matriz-peligros-colombia/)
- [Uniandes — Formato matriz de peligros y riesgos](https://planeacion.uniandes.edu.co/images/Formatos/SG-SST/FOR-45-1-05-01_Formato_matriz_de_peligros_y_riesgos.xlsx)
- [MinTrabajo — Resolución 0312 de 2019 (PDF oficial)](https://www.mintrabajo.gov.co/documents/20147/59995826/Resolucion+0312-2019-+Estandares+minimos+del+Sistema+de+la+Seguridad+y+Salud.pdf)
- [SafetYA — Resolución 0312 de 2019](https://safetya.co/normatividad/resolucion-0312-de-2019/)
- [ARL Sura — Formato FURAT (xls)](https://www.arlsura.com/formularios/furat.xls)
- [ARL Sura — Reporte de presunto accidente de trabajo](https://www.arlsura.com/index.php/centro-delegislacion-sp-26862/159-procesos-administrativos/reporte-de-presunto-accidentede-trabajo/914-reporte-de-presunto-accidente-de-trabajo)
- [MinSalud — Resolución 1401 de 2007 (PDF oficial)](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1401-2007.pdf)
- [SafetYA — Resolución 1401 de 2007](https://safetya.co/normatividad/resolucion-1401-de-2007/)
- [MinVivienda — Formato inspección de higiene y seguridad industrial (GTH-F-50)](https://www.minvivienda.gov.co/sites/default/files/procesos/GTH-F-50%20FORMATO%20SST-INSPECCI%C3%93N%20DE%20HIGIENE%20Y%20SEGURIDAD%20INDUSTRIAL%203.0.xlsx)
- [Verifty — Formato inspección de extintores](https://www.verifty.com/recursos/formato-inspeccion-extintores-excel)
- [Parques Nacionales — Formato lista de chequeo de extintores](https://old.parquesnacionales.gov.co/portal/wp-content/uploads/2019/03/Formato-lista-de-chequeo-de-extintores.xlsx)
- [MinVivienda — Formato programa de capacitación SST (GTH-F-54)](https://www.minvivienda.gov.co/sites/default/files/procesos/GTH-F-54%20FORMATO%20SST-PROGRAMA%20DE%20CAPACITACI%C3%93N%20DE%20SEGURIDAD%20Y%20SALUD%20EN%20EL%20TRABAJO%203.0.xlsx)
- [Isotools — Programa de capacitación, entrenamiento, inducción y reinducción](https://isotools.org/2016/10/18/sg-sst-programa-capacitacion-entrenamiento-induccion-reinduccion/)
- [SafetYA — Ejemplo de programa de auditoría del SG-SST](https://safetya.co/ejemplo-de-programa-de-auditoria-del-sg-sst/)
- [Historico Santander — Acta de conformación de COPASST](https://historico.santander.gov.co/intra/index.php/sig/viewdownload/628-2-formatos/10298-acta-conformacion-de-copasst)
- [Verifty — Matriz de EPP](https://www.verifty.com/recursos/matriz-epp)
- [Corponariño — Formato entrega individual EPP](https://corponarino.gov.co/wp-content/uploads/2020/04/Formato-SST-002-FORMATO-ENTREGA-INDIVIDUAL-EPPS.pdf)
- [Rama Judicial — Formato entrega de EPP (F-SST-11)](https://www.ramajudicial.gov.co/documents/8957139/8958832/F-SST-11+Formato+entrega+EPP+2022+V2.xls/c67ab34d-8b23-4add-a32a-61d04f945883)
- [FLT Ingeniería — Indicadores del SG-SST según Resolución 0312 de 2019](https://www.fltingenieriasas.com/indicadores-del-sg-sst/)
- [SafetYA — Ficha técnica de los indicadores del SG-SST](https://safetya.co/ficha-tecnica-de-los-indicadores-del-sg-sst/)
- [Veeduría Distrital — Indicadores Res. 0312](https://colibri.veeduriadistrital.gov.co/sites/default/files/2022-06/INDICADORES%200312.pdf)
