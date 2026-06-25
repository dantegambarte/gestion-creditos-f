// Contenido de la sección de Ayuda (Manual de Usuario finFlow v1.1, junio 2026).
// Texto-primero: se omiten las capturas de pantalla del documento original.
// Es contenido estático versionado; no consulta backend.

export interface HelpTable {
  headers: string[];
  rows: string[][];
}

export type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string } // sub-subtítulo dentro de una subsección
  | { kind: 'list'; intro?: string; items: string[] }
  | { kind: 'table'; table: HelpTable }
  | { kind: 'note'; text: string }
  | { kind: 'sub'; id: string; title: string; blocks: HelpBlock[] };

export interface HelpSection {
  id: string;
  title: string;
  blocks: HelpBlock[];
}

export const HELP_VERSION = 'Manual de Usuario v1.1 — Junio 2026';

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'introduccion',
    title: '1. Introducción',
    blocks: [
      {
        kind: 'p',
        text: 'Este manual tiene como objetivo guiar al usuario en el uso de finFlow, el Sistema de Créditos y Ventas, explicando paso a paso las funciones principales según el rol de cada usuario y cómo resolver los mensajes y errores más frecuentes.',
      },
      {
        kind: 'p',
        text: 'finFlow permite administrar el ciclo completo de préstamos en efectivo y ventas financiadas en cuotas: alta de clientes, generación de operaciones, aprobación, gestión de cobranza en campo, control de caja y reportes. Cada usuario accede únicamente a las funciones que corresponden a su rol.',
      },
      {
        kind: 'list',
        intro: 'Cómo está organizado este manual:',
        items: [
          'Primero se describen los requisitos, los roles y el acceso al sistema.',
          'Luego se detalla el panel principal (dashboard) que cada rol ve al iniciar sesión.',
          'Después se explican los flujos de trabajo paso a paso.',
          'Al final se incluyen mensajes comunes, preguntas frecuentes y datos de soporte.',
        ],
      },
    ],
  },
  {
    id: 'requisitos',
    title: '2. Requisitos previos',
    blocks: [
      {
        kind: 'list',
        items: [
          'Navegador recomendado: Google Chrome o Microsoft Edge en su versión actualizada.',
          'Conexión a internet: estable, ya que el sistema funciona en línea.',
          'Credenciales: usuario y contraseña asignados por el administrador.',
          'Dispositivo: se puede usar desde una computadora de escritorio, notebook o celular. La cobranza en campo está pensada para usarse desde el celular.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: '3. Roles y perfiles de acceso',
    blocks: [
      {
        kind: 'p',
        text: 'finFlow trabaja con perfiles de acceso. Cada perfil ve un panel principal y un menú distinto. Antes de operar, identificá con qué rol vas a ingresar:',
      },
      {
        kind: 'table',
        table: {
          headers: ['Perfil', 'Para qué sirve', 'Qué puede hacer'],
          rows: [
            ['Administrador', 'Gestión y control general del negocio.', 'Ver indicadores, aprobar créditos y cobros, gestionar clientes, productos, usuarios, planillas, caja, gastos, liquidaciones y reportes.'],
            ['Vendedor', 'Cargar operaciones de venta y préstamo.', 'Registrar clientes, crear pre-ventas y pre-préstamos, usar el simulador y ver sus comisiones.'],
            ['Cobrador', 'Cobranza en campo.', 'Ver su ruta del día, registrar cobros de las cuotas, dejar registro de visitas y consultar sus comisiones.'],
            ['Vendedor-Cobrador', 'Perfil combinado.', 'Reúne las funciones de Vendedor y de Cobrador en un mismo usuario.'],
            ['Cliente', 'Portal de autogestión.', 'Consultar sus créditos, próximas cuotas, estado de cuenta y usar el simulador. No registra pagos.'],
          ],
        },
      },
      {
        kind: 'note',
        text: 'Si al iniciar sesión no ves alguna de las opciones descritas en este manual, es porque no corresponden a tu rol. Consultá con el administrador si creés que necesitás otro nivel de acceso.',
      },
    ],
  },
  {
    id: 'acceso',
    title: '4. Acceso al sistema',
    blocks: [
      { kind: 'p', text: 'URL de ingreso: [Completar con la dirección web una vez desplegado el sistema]' },
      {
        kind: 'list',
        intro: 'Pasos para ingresar:',
        items: [
          'Abrir el navegador e ingresar la dirección web del sistema.',
          'En la pantalla de inicio de sesión, escribir el usuario y la contraseña.',
          'Presionar el botón de ingreso.',
          'El sistema mostrará el panel principal correspondiente a tu rol.',
        ],
      },
      {
        kind: 'p',
        text: 'Recuperación de contraseña: si olvidaste tu contraseña, usá la opción “¿Olvidaste tu contraseña?” en la pantalla de inicio de sesión y seguí las indicaciones. Si el problema continúa, el administrador puede resetear tu contraseña desde la gestión de usuarios (ver sección 6.7).',
      },
      {
        kind: 'note',
        text: 'La primera vez que ingresás, el administrador te entrega una contraseña temporal. Se recomienda cambiarla por una personal en cuanto accedas.',
      },
    ],
  },
  {
    id: 'paneles',
    title: '5. El panel principal (Dashboard) según tu rol',
    blocks: [
      {
        kind: 'p',
        text: 'Apenas iniciás sesión, finFlow muestra un panel principal distinto según tu perfil. Esta sección describe en detalle cada uno: qué información presenta, qué significa cada tarjeta y qué acciones podés realizar desde ahí.',
      },
      {
        kind: 'list',
        intro: 'Elementos comunes a todos los paneles (barra superior):',
        items: [
          'Fecha actual: se muestra el día en curso (por ejemplo, “domingo 21 de junio, 2026”).',
          'Indicador “En vivo”: señala que el sistema está actualizando la información en tiempo real.',
          'Campana de notificaciones: avisa sobre novedades y pendientes.',
          'Usuario y rol: en la esquina superior derecha aparecen tu nombre y tu perfil, con acceso a “Mi Perfil” y “Cerrar Sesión”.',
        ],
      },
      {
        kind: 'sub',
        id: 'panel-admin',
        title: '5.1 Panel del Administrador',
        blocks: [
          { kind: 'p', text: 'Es el panel más completo. Está pensado para tener, de un vistazo, el estado del negocio en el día y en el mes, los pendientes de aprobación y los accesos rápidos a las tareas más habituales.' },
          { kind: 'h', text: 'Menú lateral (Administrador)' },
          {
            kind: 'list',
            intro: 'El menú de la izquierda agrupa las opciones por secciones:',
            items: [
              'Principal: Dashboard (esta pantalla).',
              'Gestión: Operaciones, Clientes, Productos, Simulador.',
              'Administración: Usuarios, Aprobaciones, Planillas de cobro, Cobros, Mora y Canc., Caja, Gastos, Liquidaciones.',
              'Sistema: Reportes, Configuración, Ayuda.',
            ],
          },
          { kind: 'h', text: 'Tarjetas de indicadores (KPIs)' },
          { kind: 'p', text: 'En la parte superior se muestran seis tarjetas con los números clave del negocio:' },
          {
            kind: 'table',
            table: {
              headers: ['Tarjeta', 'Qué muestra', 'Cómo leerla'],
              rows: [
                ['Recaudado hoy', 'Total cobrado en el día, separado en efectivo y transferencia.', 'El renglón inferior indica la cantidad de cobros realizados en la jornada.'],
                ['Créditos activos', 'Cantidad de créditos vigentes y el saldo total de la cartera.', 'Representa el dinero que el negocio tiene colocado y en circulación.'],
                ['En mora', 'Cantidad de cuotas/créditos vencidos, su monto y el porcentaje sobre la cartera.', '“Normal” indica que la mora está bajo control. Cuanto más bajo el porcentaje, mejor.'],
                ['Pendientes de autorizar', 'Créditos y cobros que esperan tu aprobación.', '“Al día” significa que no hay nada pendiente por autorizar.'],
                ['Recaudado del mes', 'Total acumulado cobrado en el mes en curso.', 'Sirve para medir el avance de la cobranza mensual.'],
                ['Refinanciados', 'Cantidad y monto de créditos refinanciados en el mes.', 'Permite seguir cuántas operaciones se reestructuraron.'],
              ],
            },
          },
          { kind: 'h', text: 'Paneles de pendientes' },
          {
            kind: 'list',
            items: [
              'Créditos por aprobar: lista las pre-ventas y pre-préstamos cargados por los vendedores que esperan tu aprobación. El número en el círculo indica cuántos hay. Si no hay ninguno, muestra “Sin créditos pendientes”.',
              'Cobros por aprobar: lista los pre-cobros registrados por los cobradores pendientes de validación. Funciona igual que el panel anterior.',
            ],
          },
          { kind: 'h', text: 'Ranking de cuotas vencidas' },
          { kind: 'p', text: 'Tabla que muestra la cuota más antigua vencida por cada cliente, para priorizar la gestión de mora. Las columnas son: Vencimiento, Días (de atraso), Cliente, Cuota, Monto y Estado. Cuando no hay deuda vencida, indica “Sin cuotas vencidas”.' },
          { kind: 'note', text: 'El ranking muestra una cuota por cliente (la más antigua). Un mismo cliente puede tener más cuotas vencidas además de la que aparece en la lista.' },
          { kind: 'h', text: 'Accesos rápidos' },
          {
            kind: 'list',
            intro: 'Botones para iniciar de inmediato las tareas más frecuentes:',
            items: [
              'Nuevo crédito: inicia la carga de una nueva operación.',
              'Cerrar caja: va al cierre de jornada de caja.',
              'Generar planilla: abre la generación de una nueva planilla de cobro.',
              'Reportes: accede a la sección de reportes.',
            ],
          },
          { kind: 'h', text: 'Gráficos de seguimiento' },
          {
            kind: 'list',
            items: [
              'Recaudación de la semana: gráfico de barras con lo cobrado por día (de lunes a sábado).',
              'Top 5 cobradores: ranking de los cobradores con mayor recaudación.',
              'Top 5 vendedores: ranking de los vendedores con mayor monto colocado.',
            ],
          },
        ],
      },
      {
        kind: 'sub',
        id: 'panel-vendedor',
        title: '5.2 Panel del Vendedor',
        blocks: [
          { kind: 'p', text: 'Al iniciar sesión, el vendedor ve directamente la pantalla de Operaciones, con el listado de las operaciones que cargó y su estado. Desde aquí gestiona todo su trabajo de venta.' },
          { kind: 'h', text: 'Menú lateral (Vendedor)' },
          { kind: 'p', text: 'La sección Gestión incluye: Operaciones, Clientes, Productos, Simulador y Mis comisiones.' },
          { kind: 'h', text: 'Listado de operaciones' },
          { kind: 'p', text: 'La tabla central muestra una fila por operación, con estas columnas:' },
          {
            kind: 'table',
            table: {
              headers: ['Columna', 'Qué indica'],
              rows: [
                ['Tipo', 'Si la operación es Préstamo (efectivo) o Venta (producto financiado).'],
                ['Cliente', 'Nombre del cliente y su número de documento.'],
                ['Monto total', 'Importe total de la operación.'],
                ['Cuotas', 'Cantidad y periodicidad de las cuotas (por ejemplo, “4 cuotas semanales”).'],
                ['Estado', 'Situación de la operación: Pendiente de aprobación, Activo, etc.'],
                ['Fecha de alta', 'Fecha en que se registró la operación.'],
                ['Ver', 'Abre el detalle completo de la operación.'],
              ],
            },
          },
          { kind: 'h', text: 'Acciones disponibles' },
          {
            kind: 'list',
            items: [
              'Buscar por cliente o DNI: filtra el listado por cliente.',
              'Filtros “Todos” y “Tipo”: acotan por estado o por tipo de operación.',
              '+ Nueva operación: inicia la carga de una pre-venta o pre-préstamo (ver secciones 6.2 y 6.3).',
            ],
          },
          { kind: 'note', text: 'El vendedor carga operaciones, pero estas quedan en estado “Pendiente de aprobación” hasta que el administrador las apruebe.' },
        ],
      },
      {
        kind: 'sub',
        id: 'panel-cobrador',
        title: '5.3 Panel del Cobrador (Mi Ruta)',
        blocks: [
          { kind: 'p', text: 'El cobrador inicia en la pantalla “Mi Ruta”, pensada para usarse en el celular durante la cobranza en campo. Muestra las planillas asignadas para el día y un resumen de los últimos cobros.' },
          { kind: 'h', text: 'Menú lateral (Cobrador)' },
          { kind: 'p', text: 'La sección Cobranza en campo incluye: Mi Ruta, Mis cobros, Mis comisiones y Simulador.' },
          { kind: 'h', text: 'Planillas asignadas' },
          { kind: 'p', text: 'Tabla con las planillas de cobro asignadas. Sus columnas son:' },
          {
            kind: 'table',
            table: {
              headers: ['Columna', 'Qué indica'],
              rows: [
                ['Fecha', 'Día de la planilla. La etiqueta “Hoy” resalta la planilla del día actual.'],
                ['Filtro', 'Criterio con el que se generó (por ejemplo, “Todas las pendientes”).'],
                ['Cuotas', 'Cantidad de cuotas a cobrar en esa planilla.'],
                ['Generada por', 'Usuario que generó la planilla.'],
                ['Acción', 'Botón “Ver planilla” para abrirla y comenzar a cobrar.'],
              ],
            },
          },
          { kind: 'h', text: 'Cobros recientes' },
          { kind: 'p', text: 'Panel lateral que muestra los últimos cobros registrados. Incluye el enlace “Ver todos mis cobros” y un contador de cobros. Si no hay actividad reciente, indica “Sin cobros pendientes”.' },
          { kind: 'note', text: 'Para comenzar la jornada, el cobrador entra a la planilla del día con “Ver planilla” y registra cada cobro (ver sección 6.8).' },
        ],
      },
      {
        kind: 'sub',
        id: 'panel-vendedor-cobrador',
        title: '5.4 Panel del Vendedor-Cobrador',
        blocks: [
          { kind: 'p', text: 'Es un perfil combinado: reúne las funciones de Vendedor y de Cobrador. Al iniciar sesión muestra la pantalla de Operaciones (igual que el vendedor) y, en el menú lateral, suma las opciones de cobranza.' },
          { kind: 'h', text: 'Menú lateral (Vendedor-Cobrador)' },
          {
            kind: 'list',
            items: [
              'Gestión: Operaciones, Clientes, Productos, Simulador.',
              'Cobranza en campo: Mi Ruta, Mis cobros, Mis comisiones.',
            ],
          },
          { kind: 'p', text: 'De esta forma, un mismo usuario puede cargar y consultar operaciones de venta y, además, salir a cobrar con sus planillas asignadas. El detalle de cada función es el mismo descrito para los paneles del Vendedor (5.2) y del Cobrador (5.3).' },
        ],
      },
      {
        kind: 'sub',
        id: 'portal-cliente',
        title: '5.5 Portal del Cliente',
        blocks: [
          { kind: 'p', text: 'El cliente accede a un portal de autogestión con el resumen de su cuenta. Es de solo consulta: el cliente no registra pagos, ya que los cobros los realiza el cobrador y los aprueba el negocio.' },
          { kind: 'h', text: 'Navegación superior' },
          { kind: 'p', text: 'El portal tiene tres secciones: Inicio (resumen), Mis créditos y Simulador.' },
          { kind: 'h', text: 'Tarjetas del portal' },
          {
            kind: 'table',
            table: {
              headers: ['Tarjeta', 'Qué muestra'],
              rows: [
                ['Próxima cuota', 'Monto, fecha de vencimiento, días restantes y a qué crédito corresponde. Incluye “Ver detalle”.'],
                ['Estado de cuenta', 'Si está al día o con cuotas vencidas, la deuda vigente y el progreso total de pago.'],
                ['Próximos vencimientos (30 días)', 'Lista de las próximas cuotas a vencer, con fecha, monto y crédito asociado.'],
                ['Total pagado', 'Suma de todo lo abonado a lo largo de todos sus créditos.'],
                ['Mis créditos', 'Cantidad de créditos activos y liquidados, con acceso al detalle.'],
                ['Simulador', 'Acceso directo para simular un nuevo crédito y ver opciones de financiación.'],
              ],
            },
          },
          { kind: 'note', text: 'En el portal del cliente se aclara que, ante cualquier consulta sobre pagos o cuotas, debe comunicarse directamente con su cobrador.' },
        ],
      },
    ],
  },
  {
    id: 'flujos',
    title: '6. Flujos principales',
    blocks: [
      { kind: 'p', text: 'Esta sección describe, paso a paso, las operaciones más habituales del sistema. Cada flujo indica el rol que lo realiza, los pasos a seguir y los mensajes que pueden aparecer.' },
      {
        kind: 'sub',
        id: 'flujo-nuevo-cliente',
        title: '6.1 Registrar un nuevo cliente',
        blocks: [
          { kind: 'p', text: 'Objetivo: dar de alta un nuevo cliente en el sistema. Rol: Administrador o Vendedor.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Desde el menú, ingresar a Clientes.',
              'Presionar el botón “+ Nuevo Cliente”.',
              'Completar los campos obligatorios: DNI, nombre, apellido, teléfono principal, dirección y cobrador asignado.',
              'Hacer clic en “Crear Cliente”.',
              'Verificar que el cliente aparezca en la lista de clientes activos.',
            ],
          },
          {
            kind: 'list',
            intro: 'Mensajes y validaciones:',
            items: [
              '“Cliente guardado exitosamente” → la operación se realizó correctamente.',
              '“Ya existe un cliente con ese DNI” → el cliente ya está registrado en la base.',
              '“Campo obligatorio” → falta completar uno o más campos marcados con asterisco (*).',
            ],
          },
          { kind: 'p', text: 'Resultado: el cliente queda disponible para asignarle operaciones de venta o préstamo.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-pre-venta',
        title: '6.2 Realizar una pre-venta',
        blocks: [
          { kind: 'p', text: 'Objetivo: registrar la venta financiada de un producto en cuotas. Rol: Vendedor (o Administrador).' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Ingresar al menú Operaciones.',
              'Presionar “Nueva Operación”.',
              'Seleccionar el tipo de operación “Venta”.',
              'Buscar y seleccionar el cliente.',
              'Desde el catálogo, seleccionar el producto y agregar la unidad correspondiente.',
              'Configurar el plan de pagos (cantidad de cuotas y periodicidad).',
              'Enviar la operación para aprobación.',
            ],
          },
          {
            kind: 'list',
            intro: 'Mensajes y validaciones:',
            items: [
              '“El cliente tiene cuotas en mora” → el cliente registra deuda vencida; revisar antes de continuar.',
              '“Adelantar cuotas” → opción para registrar el pago anticipado de cuotas.',
            ],
          },
          { kind: 'p', text: 'Resultado: la pre-venta queda en estado “Pendiente de aprobación” a la espera de la validación del administrador.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-pre-prestamo',
        title: '6.3 Realizar un pre-préstamo',
        blocks: [
          { kind: 'p', text: 'Objetivo: dar de alta un nuevo préstamo en efectivo. Rol: Vendedor (o Administrador).' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Ingresar al menú Operaciones.',
              'Presionar “Nueva Operación”.',
              'Seleccionar el tipo de operación “Préstamo Efectivo”.',
              'Buscar y seleccionar el cliente.',
              'Ingresar el monto del préstamo.',
              'Configurar el plan de pagos (cantidad de cuotas y periodicidad).',
              'Enviar la operación para aprobación.',
            ],
          },
          {
            kind: 'list',
            intro: 'Mensajes y validaciones:',
            items: ['“El cliente tiene cuotas en mora” → el cliente registra deuda vencida; revisar antes de continuar.'],
          },
          { kind: 'p', text: 'Resultado: el pre-préstamo queda en estado “Pendiente de aprobación” a la espera de la validación del administrador.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-aprobar',
        title: '6.4 Aprobar una pre-venta o un pre-préstamo',
        blocks: [
          { kind: 'p', text: 'Objetivo: revisar y aprobar (o rechazar) las operaciones cargadas por los vendedores. Rol: Administrador. El procedimiento es el mismo tanto para una pre-venta como para un pre-préstamo.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Ingresar al menú Aprobaciones. Se muestra el listado de todas las operaciones pendientes.',
              'Presionar el botón verde para aprobar la operación.',
              'Presionar “Confirmar Aprobación”.',
            ],
          },
          {
            kind: 'list',
            intro: 'Para rechazar una operación:',
            items: ['Cancelar la operación desde el listado.', 'Describir el motivo del rechazo.', 'Confirmar.'],
          },
          {
            kind: 'list',
            intro: 'Forma alternativa (desde el detalle):',
            items: ['Ingresar a “Ver Detalles” de la operación.', 'Seleccionar “Aprobar”.', 'Presionar “Confirmar”.'],
          },
          { kind: 'p', text: 'Resultado: la operación cambia su estado a “Activo” (si se aprueba) o queda rechazada con el motivo registrado. El sistema muestra el estado actualizado del crédito.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-productos',
        title: '6.5 Gestión de Productos',
        blocks: [
          { kind: 'h', text: '6.5.1 Crear un nuevo producto' },
          { kind: 'p', text: 'Objetivo: agregar un producto nuevo al catálogo. Rol: Administrador.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Desde el menú, ingresar a Productos.',
              'Presionar el botón “+ Nuevo Producto”.',
              'Completar el campo obligatorio: Título.',
              'Hacer clic en “Crear Producto”.',
              'Verificar que el producto aparezca en la lista de productos activos.',
            ],
          },
          { kind: 'h', text: '6.5.2 Agregar una variante a un producto' },
          { kind: 'p', text: 'Objetivo: agregar una variante (por color, talle o capacidad) a un producto existente. Rol: Administrador.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Desde el menú, ingresar a Productos.',
              'Presionar el botón “Ver” del producto deseado. Se muestran todas sus variantes.',
              'Hacer clic en “+ Nueva Variante”.',
              'Completar los campos: Color, Talle, Capacidad y Precio de Venta.',
              'Hacer clic en “Agregar Variante”.',
              'Verificar que la variante aparezca en la lista de variantes activas.',
            ],
          },
          { kind: 'note', text: 'Para el alta de unidades, se puede usar el ingreso individual (una por una) o el ingreso múltiple (varias a la vez).' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-planillas',
        title: '6.6 Gestión de Planillas de cobro',
        blocks: [
          { kind: 'p', text: 'Objetivo: generar las planillas de cobro que usarán los cobradores. Rol: Administrador.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Desde el menú, ingresar a Planillas de cobro.',
              'Hacer clic en “+ Generar Nueva Planilla”.',
              'Elegir para quién se genera (el cobrador), el filtro de cuotas y la fecha.',
              'Descargar la planilla en formato PDF para imprimirla, si se necesita.',
            ],
          },
          { kind: 'p', text: 'Resultado: la planilla queda asignada al cobrador y aparece en su pantalla “Mi Ruta”.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-usuarios',
        title: '6.7 Gestión de Usuarios',
        blocks: [
          { kind: 'h', text: '6.7.1 Crear un nuevo usuario' },
          { kind: 'p', text: 'Objetivo: dar de alta un usuario del sistema (vendedor, cobrador, etc.). Rol: Administrador.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Desde el menú, ingresar a Usuarios.',
              'Hacer clic en “+ Nuevo Usuario”.',
              'Completar los campos obligatorios: Nombre Completo, DNI y Rol.',
              'Hacer clic en “Crear Usuario”.',
              'El sistema genera una contraseña temporal: anotarla y comunicarla al usuario.',
              'Hacer clic en “Ya la anoté y comuniqué”.',
            ],
          },
          { kind: 'h', text: '6.7.2 Resetear la contraseña de un usuario' },
          { kind: 'p', text: 'Objetivo: generar una nueva contraseña temporal para un usuario. Rol: Administrador.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Desde el panel de Usuarios, hacer clic en “Ver” sobre el usuario.',
              'Hacer clic en “Resetear Contraseña”.',
              'En el cartel de confirmación, hacer clic en “Resetear”.',
              'El sistema genera una contraseña temporal: anotarla y comunicarla al usuario.',
              'Hacer clic en “Ya la anoté y comuniqué”.',
            ],
          },
          { kind: 'note', text: 'La contraseña temporal debe comunicarse al usuario por un medio seguro. Se recomienda que el usuario la cambie en cuanto ingrese.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-cobros',
        title: '6.8 Gestión de Cobros',
        blocks: [
          { kind: 'h', text: '6.8.1 Registrar un pre-cobro (cobrador)' },
          { kind: 'p', text: 'Objetivo: registrar el cobro de una cuota durante la cobranza en campo. Rol: Cobrador (o Vendedor-Cobrador).' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Ingresar con el perfil de cobrador.',
              'En la pantalla principal, ingresar a “Mi Ruta”.',
              'Abrir la planilla del día con “Ver Planilla” (la que indica “Hoy”).',
              'Hacer clic en “Cobrar” sobre el cliente que corresponda.',
              'Elegir el método de pago: Efectivo, Transferencia o Efectivo + Transferencia.',
              'Ingresar los montos. Si es transferencia, opcionalmente cargar la referencia de la transferencia.',
              'Hacer clic en “Confirmar”.',
            ],
          },
          { kind: 'h', text: '6.8.2 Flujo alterno: no pagó / no encontrado' },
          { kind: 'p', text: 'Cuándo se usa: cuando no se pudo cobrar la cuota.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Hacer clic en “Abrir Registro Cobro”.',
              'Sobre el cliente, seleccionar la opción correspondiente: “Registrar pre-carga”, “No pagó” o “No encontrado”.',
              'Si se elige “No pagó”, seleccionar la fecha de la próxima visita.',
              'Describir el motivo y hacer clic en “Confirmar”.',
              'No pagó: se agenda una próxima visita para reintentar el cobro.',
              'No encontrado: la cuota seguirá apareciendo en las próximas planillas.',
            ],
          },
          { kind: 'h', text: '6.8.3 Aprobar un pre-cobro (administrador)' },
          { kind: 'p', text: 'Objetivo: validar los cobros registrados por los cobradores. Rol: Administrador. Existen dos maneras de aprobar los cobros:' },
          {
            kind: 'list',
            intro: 'Opción A — desde el dashboard (“Cobros por aprobar”):',
            items: [
              'Hacer clic en “Aprobar” sobre el cobro pendiente.',
              'En el cartel de confirmación, hacer clic en “Sí, Aprobar”.',
              'El sistema muestra el mensaje “Cobro aprobado exitosamente”.',
            ],
          },
          {
            kind: 'list',
            intro: 'Opción B — desde la sección Cobros:',
            items: ['Seleccionar un pre-cobro de la lista.', 'Hacer clic en el cobro para ver su detalle.', 'Hacer clic en “Aprobar”.'],
          },
          { kind: 'p', text: 'Resultado: el cobro queda confirmado e impacta en la recaudación y en el estado de cuenta del cliente.' },
        ],
      },
      {
        kind: 'sub',
        id: 'flujo-caja',
        title: '6.9 Gestión de Caja',
        blocks: [
          { kind: 'p', text: 'Objetivo: controlar los ingresos y egresos de dinero de la jornada. Rol: Administrador.' },
          {
            kind: 'list',
            intro: 'Pasos:',
            items: [
              'Ingresar con el perfil de administrador.',
              'Hacer clic en Caja.',
              'Para comenzar el día, primero “Abrir Caja”.',
              'Durante la jornada se registran los ingresos y egresos de capital.',
              'Al finalizar el día, realizar el “Cierre de Jornada”.',
            ],
          },
          {
            kind: 'list',
            intro: 'Operaciones disponibles en Caja:',
            items: [
              'Registrar Gasto: registra un egreso de dinero.',
              'Ingreso Manual de efectivo: registra un ingreso de dinero que no proviene de un cobro.',
              'Convertir Dinero: pasa dinero de efectivo a transferencia y viceversa.',
            ],
          },
          { kind: 'note', text: 'Es importante “Abrir Caja” al inicio del día y realizar el “Cierre de Jornada” al final para que la recaudación quede correctamente registrada.' },
        ],
      },
    ],
  },
  {
    id: 'mensajes',
    title: '7. Mensajes y errores comunes',
    blocks: [
      { kind: 'p', text: 'La siguiente tabla resume los mensajes más frecuentes del sistema y qué hacer ante cada uno:' },
      {
        kind: 'table',
        table: {
          headers: ['Mensaje', 'Significado', 'Qué hacer'],
          rows: [
            ['Cliente guardado exitosamente', 'El cliente se registró correctamente.', 'No requiere acción.'],
            ['Ya existe un cliente con ese DNI', 'El cliente ya está en la base.', 'Buscar el cliente existente en lugar de crear uno nuevo.'],
            ['Campo obligatorio', 'Falta completar un dato requerido.', 'Completar los campos marcados con asterisco (*).'],
            ['El cliente tiene cuotas en mora', 'El cliente registra deuda vencida.', 'Revisar la situación del cliente antes de avanzar con la operación.'],
            ['Cobro aprobado exitosamente', 'El pre-cobro fue validado.', 'No requiere acción.'],
            ['Pendiente de aprobación', 'La operación espera validación del administrador.', 'Aguardar la aprobación o, si sos administrador, revisarla en Aprobaciones.'],
          ],
        },
      },
    ],
  },
  {
    id: 'faq',
    title: '8. Preguntas frecuentes (FAQ)',
    blocks: [
      { kind: 'h', text: '¿Por qué no veo algunas opciones del menú?' },
      { kind: 'p', text: 'El menú depende de tu rol. Cada perfil ve solo las funciones que le corresponden. Si necesitás otro acceso, consultá con el administrador.' },
      { kind: 'h', text: 'Cargué una operación pero sigue “pendiente”. ¿Qué pasa?' },
      { kind: 'p', text: 'Las pre-ventas y pre-préstamos quedan pendientes hasta que el administrador las aprueba desde la sección Aprobaciones.' },
      { kind: 'h', text: 'Olvidé mi contraseña. ¿Cómo la recupero?' },
      { kind: 'p', text: 'Usá la opción “¿Olvidaste tu contraseña?” en el inicio de sesión. Si no se resuelve, el administrador puede resetearla (sección 6.7).' },
      { kind: 'h', text: 'Soy cliente. ¿Puedo pagar desde el portal?' },
      { kind: 'p', text: 'No. El portal del cliente es de consulta. Los pagos los registra tu cobrador. Ante dudas sobre pagos o cuotas, contactá directamente a tu cobrador.' },
      { kind: 'h', text: 'No pude cobrarle a un cliente. ¿Qué registro?' },
      { kind: 'p', text: 'Usá el flujo alterno “No pagó” (agenda una próxima visita) o “No encontrado” (la cuota vuelve a aparecer en próximas planillas). Ver sección 6.8.2.' },
      { kind: 'h', text: '¿Por qué la recaudación del día aparece en cero?' },
      { kind: 'p', text: 'Verificá que la caja esté abierta y que los cobros del día estén aprobados. Los cobros impactan una vez validados por el administrador.' },
    ],
  },
  {
    id: 'soporte',
    title: '9. Soporte técnico',
    blocks: [
      { kind: 'p', text: 'Ante cualquier duda o inconveniente que no se encuentre contemplado en este manual, contactá al área de Soporte Técnico para recibir asistencia.' },
      {
        kind: 'table',
        table: {
          headers: ['Canal', 'Dato de contacto'],
          rows: [
            ['Correo electrónico', '[Completar correo de soporte]'],
            ['Teléfono / WhatsApp', '[Completar teléfono de soporte]'],
            ['Horario de atención', '[Completar horario de atención]'],
          ],
        },
      },
      {
        kind: 'list',
        intro: 'Antes de contactar a soporte, tené a mano:',
        items: [
          'Tu nombre de usuario y rol.',
          'Una descripción de lo que estabas haciendo cuando ocurrió el problema.',
          'El mensaje de error exacto (una captura de pantalla ayuda mucho).',
        ],
      },
    ],
  },
  {
    id: 'consideraciones',
    title: '10. Consideraciones finales',
    blocks: [
      { kind: 'p', text: 'El presente manual constituye una guía práctica para el uso correcto de finFlow, el Sistema de Créditos y Ventas, detallando los principales flujos de trabajo, los paneles de cada rol, los mensajes de alerta y los procedimientos de gestión.' },
      { kind: 'p', text: 'El objetivo es que cada usuario pueda operar de manera eficiente, segura y confiable, reduciendo errores y optimizando los procesos de la empresa.' },
      { kind: 'p', text: 'Este documento debe utilizarse como referencia permanente y actualizarse en cada nueva versión del sistema. Con el compromiso de mejora continua, será revisado periódicamente para incorporar nuevas funcionalidades y garantizar información clara y actualizada.' },
    ],
  },
];
