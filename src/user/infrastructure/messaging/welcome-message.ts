// Contrato do tópico (JSON), igual nos três templates. Evolução: só adicionar campos.
export const WELCOME_TOPIC = 'user.welcome-requested';

export interface WelcomeMessage {
  userId: string;
  email: string;
  name: string;
  occurredAt: string; // ISO-8601
}
