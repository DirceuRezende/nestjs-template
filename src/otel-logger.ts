import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { logs, SeverityNumber } from '@opentelemetry/api';

const otel = logs.getLogger('nest');

/**
 * Logger do Nest que, além do console, emite cada linha como log OTel (ligado ao trace ativo).
 * Sem SDK carregado (testes) o `emit` é no-op.
 */
export class OtelLogger extends ConsoleLogger {
  override log(message: unknown, ...rest: unknown[]) {
    super.log(message, ...rest);
    this.emit('log', SeverityNumber.INFO, message, rest);
  }
  override warn(message: unknown, ...rest: unknown[]) {
    super.warn(message, ...rest);
    this.emit('warn', SeverityNumber.WARN, message, rest);
  }
  override error(message: unknown, ...rest: unknown[]) {
    super.error(message, ...rest);
    this.emit('error', SeverityNumber.ERROR, message, rest);
  }
  override fatal(message: unknown, ...rest: unknown[]) {
    super.fatal(message, ...rest);
    this.emit('fatal', SeverityNumber.FATAL, message, rest);
  }
  override debug(message: unknown, ...rest: unknown[]) {
    super.debug(message, ...rest);
    this.emit('debug', SeverityNumber.DEBUG, message, rest);
  }
  override verbose(message: unknown, ...rest: unknown[]) {
    super.verbose(message, ...rest);
    this.emit('verbose', SeverityNumber.TRACE, message, rest);
  }

  private emit(
    level: LogLevel,
    severityNumber: SeverityNumber,
    message: unknown,
    rest: unknown[],
  ) {
    if (!this.isLevelEnabled(level)) return;
    // Logger do Nest põe o contexto (nome da classe) por último; no error, a stack vem antes dele.
    const context = rest.at(-1) ?? this.context;
    const stack =
      level === 'error' || level === 'fatal' ? rest.at(-2) : undefined;
    otel.emit({
      severityNumber,
      severityText: SeverityNumber[severityNumber], // INFO, WARN... (nome do enum)
      body:
        typeof message === 'string'
          ? message
          : message instanceof Error
            ? message.message
            : JSON.stringify(message),
      attributes: {
        ...(typeof context === 'string' && { 'log.context': context }),
        ...(typeof stack === 'string' && { 'exception.stacktrace': stack }),
      },
    });
  }
}
