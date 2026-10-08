export interface EmailProviderPreset {
  id: string;
  label: string;
  color: string; // clase de texto/tinte del ícono
  bgClass: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  steps: string[];
}

export const EMAIL_PROVIDERS: EmailProviderPreset[] = [
  {
    id: "gmail",
    label: "Gmail",
    color: "text-red-400",
    bgClass: "bg-red-500/10",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    steps: [
      "Entrá a myaccount.google.com/security y activá la Verificación en 2 pasos si todavía no la tenés.",
      "En el buscador de esa misma página escribí \"Contraseñas de aplicaciones\" y creá una nueva (podés llamarla \"CRM\").",
      "Google te va a mostrar una contraseña de 16 caracteres — copiala, la vas a usar en el campo Contraseña de este formulario (no la de tu cuenta).",
      "Usá tu dirección de Gmail completa como Usuario.",
    ],
  },
  {
    id: "outlook",
    label: "Outlook / Office 365",
    color: "text-blue-400",
    bgClass: "bg-blue-500/10",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    steps: [
      "Iniciá sesión en outlook.com con la cuenta que querés conectar.",
      "Si tu organización exige autenticación multifactor, generá una contraseña de aplicación desde account.microsoft.com/security.",
      "Usá tu dirección de correo completa como Usuario y esa contraseña (o la de tu cuenta si no tenés MFA) como Contraseña.",
    ],
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    color: "text-purple-400",
    bgClass: "bg-purple-500/10",
    host: "smtp.mail.yahoo.com",
    port: 587,
    secure: false,
    steps: [
      "Entrá a account.yahoo.com/account/security y activá la verificación en 2 pasos.",
      "Buscá \"Generar contraseña de aplicación\", creá una nueva para \"CRM\" o similar.",
      "Usá tu dirección de Yahoo completa como Usuario y la contraseña generada como Contraseña.",
    ],
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    color: "text-amber-400",
    bgClass: "bg-amber-500/10",
    host: "smtp.zoho.com",
    port: 587,
    secure: false,
    steps: [
      "Entrá a accounts.zoho.com y activá la autenticación en 2 factores si no la tenés.",
      "En Configuración de seguridad generá una \"Contraseña específica de la aplicación\".",
      "Usá tu dirección de Zoho completa como Usuario y esa contraseña como Contraseña.",
    ],
  },
  {
    id: "custom",
    label: "SMTP personalizado",
    color: "text-muted-foreground",
    bgClass: "bg-muted",
    host: null,
    port: 587,
    secure: false,
    steps: [
      "Pedile a tu proveedor de hosting o email los datos de tu servidor SMTP de salida: host, puerto y si usa SSL/TLS.",
      "Completá host, puerto, usuario y contraseña manualmente en el formulario.",
      "Si tu proveedor usa el puerto 465, marcá la opción SSL/TLS; si usa 587, generalmente se deja sin marcar (STARTTLS).",
    ],
  },
];
