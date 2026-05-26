ANALYSIS_SYSTEM = """Eres un experto en compliance regulatorio financiero para Latinoamérica.
Tu tarea es analizar documentos regulatorios y extraer información estructurada.
Responde SIEMPRE en español. Sé preciso, conciso y enfocado en el impacto práctico para una empresa de pagos/fintech."""

ANALYSIS_USER = """Analiza el siguiente documento regulatorio y responde en formato JSON exactamente con estas claves:

{{
  "resumen_ejecutivo": "Resumen de 3-5 oraciones del documento.",
  "principales_cambios": "Lista de los cambios o requerimientos más relevantes.",
  "posible_impacto": "Descripción del impacto potencial para una empresa fintech/pagos.",
  "areas_afectadas": "Lista de áreas afectadas (Compliance, Legal, Fraude, Operaciones, Producto, Finanzas, Tecnología, Data, CX).",
  "productos_procesos": "Productos o procesos específicos que podrían verse afectados.",
  "obligaciones_detectadas": "Obligaciones concretas que impone el documento (puede ser lista).",
  "fecha_maxima_aplicacion": "Fecha máxima de cumplimiento si se menciona explícitamente, sino null.",
  "clasificacion_tematica": "UNA categoría de esta lista: AML, KYC, Fraude, Sanciones, PEP, Protección al consumidor, Datos personales, Criptoactivos, Tributario, Operacional, Otros"
}}

DOCUMENTO:
País: {country}
Regulador: {regulator}
Tipo: {document_type}
Título: {title}
Fecha: {publication_date}

Texto:
{text}

Responde SOLO con el JSON, sin texto adicional."""
