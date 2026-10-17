export interface IEmailService {
  sendPasswordResetEmail(toEmail: string, userName: string, rawToken: string): Promise<boolean>;
}

export class MockConsoleEmailService implements IEmailService {
  private baseUrl: string;

  constructor(baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async sendPasswordResetEmail(toEmail: string, userName: string, rawToken: string): Promise<boolean> {
    const resetUrl = `${this.baseUrl}/restablecer-contrasena?token=${rawToken}`;
    
    console.log("================================================================================");
    console.log(" [MOCK EMAIL SERVICE - NOTIFICACION INSTITUCIONAL UNAPEC]");
    console.log(` Para: ${userName} <${toEmail}>`);
    console.log(" Asunto: Recuperación de Acceso - Sistema ActivaCore UNAPEC");
    console.log("--------------------------------------------------------------------------------");
    console.log(" Estimado/a usuario/a:");
    console.log(" Hemos recibido una solicitud para restablecer su contraseña institucional.");
    console.log(" Este enlace es de un solo uso y expirará en 15 minutos:");
    console.log(` -> ${resetUrl}`);
    console.log(" Si usted no solicitó este cambio, ignore este mensaje.");
    console.log("================================================================================");

    return true;
  }
}

export const emailService: IEmailService = new MockConsoleEmailService();