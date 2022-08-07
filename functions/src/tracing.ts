import * as opentelemetry from "@opentelemetry/sdk-node";
import {diag, DiagConsoleLogger, DiagLogLevel} from "@opentelemetry/api";
import {TraceExporter} from "@google-cloud/opentelemetry-cloud-trace-exporter";
import {
  getNodeAutoInstrumentations,
} from "@opentelemetry/auto-instrumentations-node";
import {gcpDetector} from "@opentelemetry/resource-detector-gcp";
import {envDetector, processDetector} from "@opentelemetry/resources";
import {
  CloudPropagator,
} from "@google-cloud/opentelemetry-cloud-trace-propagator";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

// TODO: Probaability sampler? or how do I follow Load Balancer's 0.1 rate?
// tMake sure I read and propagate the flag correctly?
// THIS LAREADY WORKS. THINK CloudPropagator or something is correctly doing it.
// OR propagator is working as intended.
const sdk = new opentelemetry.NodeSDK({
  traceExporter: new TraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
  textMapPropagator: new opentelemetry.core.CompositePropagator({
    propagators: [
      new opentelemetry.core.W3CTraceContextPropagator,
      new CloudPropagator(),
    ],
  }),
  autoDetectResources: false,
});

(() => {
  let started = false;
  return async () => {
    if (!started) {
      started = true;
      await sdk.detectResources({
        // TODO: a run detector? GCF detector?
        detectors: [gcpDetector, envDetector, processDetector],
      });
      await sdk.start();
    }
  };
})()();

// TODO: Are other NODE_OPTIONS overriden or merged?
// E.G. CHECK HEAP SIZE

import * as logger from "firebase-functions/logger";
// Flush spans on shutdown
process.on("SIGTERM", async () => {
  logger.info("received SIGTERM");
  await sdk.shutdown();
});
