export const SITE = {
  // Datos de EJEMPLO. Reemplaza estos valores por los del asesor que compre la plantilla.
  name: "Vértice Patrimonial",
  brand: "Vértice Patrimonial",
  tagline: "Protección patrimonial con propósito.",
  whatsapp: "5215500000000",
  whatsappUrl: (text: string) =>
    `https://wa.me/5215500000000?text=${encodeURIComponent(text)}`,
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  email: "contacto@ejemplo.mx",
  nav: [
    { label: "Inicio", href: "/" },
    { label: "Beneficios", href: "/#beneficios" },
    { label: "Plataforma", href: "/#plataforma" },
    { label: "Cómo funciona", href: "/#como-funciona" },
    { label: "Contacto", href: "/#contacto" },
  ],
};

export const AREAS = [
  { name: "Protección Familiar", icon: "👨‍👩‍👧‍👦" },
  { name: "Salud", icon: "🩺" },
  { name: "Ingresos", icon: "💼" },
  { name: "Movilidad", icon: "🚗" },
  { name: "Hogar", icon: "🏠" },
  { name: "Educación", icon: "🎓" },
  { name: "Retiro", icon: "🌅" },
  { name: "Negocio", icon: "🏢" },
];
