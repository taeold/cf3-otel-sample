import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onValueCreated} from "firebase-functions/v2/database";
import {getFirestore} from "firebase-admin/firestore";

import {trace} from "@opentelemetry/api";

admin.initializeApp();

const sleep = (sleepMs: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), sleepMs);
  });
};

export const reqv2 = onRequest({ maxInstances: 1 }, async (req, res) => {
  logger.info("request headers:", req.headers);

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

export const reqv2simple = onRequest((req, res) => {
  logger.info("request headers:", req.headers);
  res.sendStatus(200);
});

export const rtdbv2 = onValueCreated("/foo/{id}", async (event) => {
  logger.info("event headers:", event);
});

export const rtdbv1 = functions.database.ref("/foo/{id}").onCreate((snap, ctx) => {
  logger.info("event headers:", ctx);
});
