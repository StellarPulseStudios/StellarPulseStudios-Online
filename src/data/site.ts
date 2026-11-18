// Datos generales de Stellar Pulse y del próximo evento.
// Para una nueva edición basta con cambiar los valores de `currentEvent`.

export const contact = {
  email: 'stellarpstudios@gmail.com',
  instagram: 'https://www.instagram.com/stellarpulse_studios/',
  instagramHandle: '@stellarpulse_studios',
};

/** Enlace de correo con el asunto ya escrito. */
export function mailto(subject: string): string {
  return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}`;
}

export const currentEvent = {
  name: 'Stellar Nights',
  edition: 'Christmas Edition',
  fullName: 'Stellar Nights · Christmas Edition',
  path: '/eventos/stellar-nights/',
  ticketsUrl:
    'https://www.tickean.com.mx/eventos/stellar-nights-christmas-edition',
  startDate: '2026-12-05T15:30:00-06:00',
  endDate: '2026-12-05T22:30:00-06:00',
  dateLabel: 'Sábado 5 de diciembre, 2026',
  day: '05',
  month: 'Diciembre',
  timeLabel: '15:30 a 22:30 h',
  venue: {
    name: 'Finca San Blas',
    city: 'Toluca, Estado de México',
    /** Slug del lugar en el directorio (Notion), para tomar mapa y ficha. */
    slug: 'finca-san-blas',
  },
  sponsor: {
    name: 'Materiales Pérez',
    slug: 'materiales-perez',
    logo: '/brand/materiales-perez-logo.webp',
  },
  description:
    'Una noche navideña con emprendimientos locales, comida, bebidas y música en vivo en Finca San Blas, Toluca.',
};
