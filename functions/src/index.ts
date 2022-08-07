import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onValueCreated} from "firebase-functions/v2/database";
import {getFirestore} from "firebase-admin/firestore";

import {trace} from "@opentelemetry/api";

admin.initializeApp();

const TRACE_PARENT_REGEX = new RegExp(
    "^(?<version>[\\da-f]{2})-" +
  "(?<traceId>[\\da-f]{32})-" +
  "(?<parentId>[\\da-f]{16})-" +
  "(?<flag>[\\da-f]{2})$",
);

interface TraceParent {
  version: string,
  traceId: string,
  parentId: string,
  flag: string
}

function getTraceParent(o: any): TraceParent | undefined {
  const traceParent = o["traceparent"];
  if (!traceParent) {
    return;
  }
  const matches = TRACE_PARENT_REGEX.exec(traceParent);
  if (!matches || !matches.groups) {
    return;
  }
  const {version, traceId, parentId, flag} = matches.groups;
  return {version, traceId, parentId, flag};
}

function formatCloudTrace(traceId: string): string {
  return `projects/${process.env.GCLOUD_PROJECT}/traces/${traceId}`;
}

interface LogContext {
  "logging.googleapis.com/trace"?: string;
}

function createLogContext(o: any): LogContext {
  const tp = getTraceParent(o);
  const ctx: LogContext = {};
  if (tp) {
    ctx["logging.googleapis.com/trace"] = formatCloudTrace(tp.traceId);
  }
  return ctx;
}

const sleep = (sleepMs: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), sleepMs);
  });
};

export const reqv2 = onRequest(async (req, res) => {
  logger.info("request headers:", {
    ...req.headers,
    ...createLogContext(req.headers),
    // Pretty useless
    ["logging.googleapis.com/labels"]: {functionName: process.env.K_SERVICE},
  });

  const db = getFirestore();
  const doc = db.collection("requests").doc();
  await doc.set({...req.headers});

  const tracer = trace.getTracer(
      `${process.env.K_SERVICE}-trace`,
  );
  await tracer.startActiveSpan("randomSleep", async (span) => {
    logger.info(`inside span, traceId=${span.spanContext().traceId}`, {
      ...span.spanContext(),
    });
    await sleep(Math.random() * 5000);
    span.end();
  });
  res.sendStatus(200);
});

export const rtdbv2 = onValueCreated("/foo/{id}", async (event) => {
  logger.info("event headers:", {
    ...event,
    ...createLogContext(event),
    ["logging.googleapis.com/labels"]: {functionName: process.env.K_SERVICE},
  });
});

export const rtdbv1 = functions.database.ref("/foo/{id}").onCreate((snap, ctx) => {
  logger.info("event headers:", ctx);
});
