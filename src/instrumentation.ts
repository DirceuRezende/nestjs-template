/**
 * OpenTelemetry: traces, métricas e logs via OTLP (http/protobuf, padrão localhost:4318).
 * Carregado antes do app com `node --import ./dist/instrumentation.js`; nenhum código de src/ importa este arquivo.
 * Config pelas variáveis padrão OTEL_* (OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME, OTEL_SDK_DISABLED=true...).
 */
import { register } from 'node:module';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

// O app é ESM: o hook (import-in-the-middle) é o que deixa a instrumentação corrigir pg, express etc.
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

// shortcut: @confluentinc/kafka-javascript não tem instrumentação OTel (a do kafkajs não pega) e a do Nest só cobre <12, o trace para no outbox; upgrade: propagar traceparent no header da mensagem do outbox e abrir span manual no relay/consumer.
const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'user-template',
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // ruído: um span por leitura de arquivo
      // sem isto o polling do OutboxRelay (1/s) e as migrations viram um trace por query
      '@opentelemetry/instrumentation-pg': { requireParentSpan: true },
    }),
  ],
});
sdk.start();

// O Nest fecha o app no sinal (enableShutdownHooks); aqui só esvazia os buffers de telemetria.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => void sdk.shutdown());
}
