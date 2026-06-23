import express, { type Request, type Response } from "express";
import { listProducts, listCategories } from "./product.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/products", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "20"), 10) || 20,
      100,
    );
    const category =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const result = await listProducts({ limit, category, cursor });
    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CURSOR") {
      return res.status(400).json({ error: "Invalid cursor" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await listCategories();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
