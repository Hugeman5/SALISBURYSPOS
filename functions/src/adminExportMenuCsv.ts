
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";


export const adminExportMenuCsv = onCall(async (req)=>{
  const ctx = req.auth;
  if (!ctx) throw new Error("UNAUTH");
  const role = (ctx.token as {role?: string})?.role;
  if (!["admin", "manager"].includes(role ?? "")) throw new Error("FORBIDDEN");

  const db = getFirestore();
  const [cats, items] = await Promise.all([
    db.collection("menu_categories").get(),
    db.collection("menu_items").get(),
  ]);

  const byCat: Record<string, string> = {};
  cats.docs.forEach((d)=> {
    byCat[d.id] = (d.data() as {name: string}).name;
  });

  const header = ["category", "item", "sku", "plu", "price", "active"];
  const rows = items.docs.map((d)=>{
    const x = d.data() as any;
    const price = (x.priceCents/100).toFixed(2);
    const active = x.active ? "1" : "0";
    return [
      byCat[x.categoryId]||"", x.name, x.sku||"", x.plu||"", price, active,
    ].join(",");
  });
  return {
    ok: true,
    filename: "menu.csv",
    csv: header.join(",")+"\n"+rows.join("\n"),
  };
});
