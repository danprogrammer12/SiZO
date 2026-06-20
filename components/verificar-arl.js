import modal from './modal.js'
import toast from './toast.js'

export function abrirVerificadorARL() {
  modal.open({
    title: 'Consultar ARL — Mi Seguridad Social',
    content: `
      <p style="margin-bottom:var(--space-3);color:var(--color-text-secondary);font-size:var(--font-size-sm)">
        Ingresa la cédula del trabajador. Se copiará al portapapeles y se abrirá
        el portal <strong>Mi Seguridad Social</strong> para que pegues el número.
      </p>
      <div class="form-group">
        <label style="display:block;font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:var(--space-1)">Número de cédula</label>
        <input id="arl-cedula" type="text" inputmode="numeric"
          placeholder="Ej. 1234567890"
          style="width:100%;padding:var(--space-2) var(--space-3);
            border:1px solid var(--color-border);border-radius:var(--radius-md);
            background:var(--color-surface);color:var(--color-text-primary);
            font-size:var(--font-size-sm);box-sizing:border-box"/>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="arl-cancelar">Cancelar</button>
      <button class="btn btn-primary" id="arl-abrir">Copiar y abrir portal</button>
    `,
    size: 'sm',
  })

  // setTimeout garantiza que el foco llega después del requestAnimationFrame del modal
  setTimeout(() => document.getElementById('arl-cedula')?.focus(), 50)

  document.getElementById('arl-cancelar').addEventListener('click', () => modal.close())

  const abrir = async () => {
    const input  = document.getElementById('arl-cedula')
    const cedula = input?.value.trim()
    if (!cedula) {
      if (input) input.style.borderColor = 'var(--color-danger)'
      return
    }
    try {
      await navigator.clipboard.writeText(cedula)
      toast.success('Cédula copiada — pégala en el portal')
    } catch {
      toast.info(`Cédula: ${cedula} — cópiala manualmente`)
    }
    window.open('https://www.miseguridadsocial.gov.co', '_blank', 'noopener')
    modal.close()
  }

  document.getElementById('arl-abrir').addEventListener('click', abrir)
  document.getElementById('arl-cedula').addEventListener('keydown', e => { if (e.key === 'Enter') abrir() })
}

export function abrirPortalADRES() {
  window.open('https://www.adres.gov.co/consulte-su-eps', '_blank', 'noopener')
}
