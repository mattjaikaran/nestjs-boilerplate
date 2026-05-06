import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'nestjs-boilerplate';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const enabled = process.env.OTEL_ENABLED !== 'false';

let sdk: NodeSDK | undefined;

export function startTracing() {
  if (!enabled) return;

  const exporterConfig = otlpEndpoint ? { url: `${otlpEndpoint}/v1/traces` } : {};

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    }),
    traceExporter: new OTLPTraceExporter(exporterConfig),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('OpenTelemetry SDK shut down'))
      .catch((err: unknown) => console.error('Error shutting down OTel SDK', err));
  });
}
