import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

/**
 * A generic wrapper for calling Firebase Cloud Functions.
 * @param name The name of the callable function.
 * @param data The data payload to send to the function.
 * @returns A promise that resolves with the data returned by the function.
 */
export async function call<TRes, TReq>(name: string, data: TReq): Promise<TRes> {
  const functions = getFunctions(app);
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const res = await fn(data);
  return res.data;
}
