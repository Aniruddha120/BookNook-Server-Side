import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { Db, MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface BookInput {
  title: string;
  author: string;
  category: string;
  image: string;
  description: string;
  totalCopies: number;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
const dbName = process.env.DB_NAME || "booknook";
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

let db: Db;

const jwks = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).send({ message: "You must be logged in" });
  }

  jwtVerify(token, jwks, { issuer: "booknook", audience: "booknook-api" })
    .then(({ payload }) => {
      req.user = {
        id: String(payload.sub),
        email: String(payload.email),
        name: String(payload.name),
      };
      next();
    })
    .catch(() => {
      res.status(401).send({ message: "Invalid or expired token" });
    });
}

async function connectDb() {
  await client.connect();
  db = client.db(dbName);
  console.log("Connected to MongoDB:", dbName);
}

app.get("/", (req: Request, res: Response) => {
  res.send("BookNook API is running");
});

app.get("/books", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 0;
    const books = await db
      .collection("books")
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    res.send(books);
  } catch (error) {
    res.status(500).send({ message: "Could not load books" });
  }
});

app.get("/books/:id", async (req: Request, res: Response) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }
    const book = await db
      .collection("books")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }
    res.send(book);
  } catch (error) {
    res.status(500).send({ message: "Could not load the book" });
  }
});

app.post("/books", requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, author, category, image, description, totalCopies } =
      req.body as BookInput;

    if (!title || !author || !category || !image || !description) {
      return res.status(400).send({ message: "Please fill in every field" });
    }

    const copies = Number(totalCopies) || 1;

    const book = {
      title,
      author,
      category,
      image,
      description,
      totalCopies: copies,
      copies,
      userEmail: req.user?.email,
      userName: req.user?.name,
      createdAt: new Date(),
    };

    const result = await db.collection("books").insertOne(book);
    res.status(201).send({ ...book, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: "Could not add the book" });
  }
});

app.patch("/books/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }

    const id = new ObjectId(req.params.id);
    const book = await db.collection("books").findOne({ _id: id });

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    if (book.userEmail !== req.user?.email) {
      return res.status(403).send({ message: "You can only edit your own books" });
    }

    const { title, author, category, image, description, totalCopies } =
      req.body as BookInput;

    const copies = Number(totalCopies) || book.totalCopies;
    const borrowed = book.totalCopies - book.copies;

    await db.collection("books").updateOne(
      { _id: id },
      {
        $set: {
          title,
          author,
          category,
          image,
          description,
          totalCopies: copies,
          copies: Math.max(copies - borrowed, 0),
        },
      }
    );

    const updated = await db.collection("books").findOne({ _id: id });
    res.send(updated);
  } catch (error) {
    res.status(500).send({ message: "Could not update the book" });
  }
});

app.delete("/books/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }

    const id = new ObjectId(req.params.id);
    const book = await db.collection("books").findOne({ _id: id });

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    if (book.userEmail !== req.user?.email) {
      return res.status(403).send({ message: "You can only delete your own books" });
    }

    await db.collection("books").deleteOne({ _id: id });
    res.send({ message: "Book deleted" });
  } catch (error) {
    res.status(500).send({ message: "Could not delete the book" });
  }
});

app.post("/borrows", requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.body as { bookId: string };

    if (!bookId || !ObjectId.isValid(bookId)) {
      return res.status(400).send({ message: "Invalid book id" });
    }

    const id = new ObjectId(bookId);
    const book = await db.collection("books").findOne({ _id: id });

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    if (book.copies < 1) {
      return res.status(400).send({ message: "This book is not available right now" });
    }

    const existing = await db
      .collection("borrows")
      .findOne({ bookId: id, userEmail: req.user?.email });

    if (existing) {
      return res.status(400).send({ message: "You already borrowed this book" });
    }

    const borrowDate = new Date();
    const returnDate = new Date();
    returnDate.setDate(borrowDate.getDate() + 7);

    const borrow = {
      bookId: id,
      bookTitle: book.title,
      bookImage: book.image,
      userEmail: req.user?.email,
      borrowDate,
      returnDate,
    };

    const result = await db.collection("borrows").insertOne(borrow);
    await db.collection("books").updateOne({ _id: id }, { $inc: { copies: -1 } });

    res.status(201).send({ ...borrow, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: "Could not borrow the book" });
  }
});

app.get("/borrows", requireAuth, async (req: Request, res: Response) => {
  try {
    const borrows = await db
      .collection("borrows")
      .find({ userEmail: req.user?.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.send(borrows);
  } catch (error) {
    res.status(500).send({ message: "Could not load your borrows" });
  }
});

app.delete("/borrows/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid borrow id" });
    }

    const id = new ObjectId(req.params.id);
    const borrow = await db.collection("borrows").findOne({ _id: id });

    if (!borrow) {
      return res.status(404).send({ message: "Borrow not found" });
    }

    if (borrow.userEmail !== req.user?.email) {
      return res.status(403).send({ message: "You can only return your own books" });
    }

    await db.collection("borrows").deleteOne({ _id: id });
    await db
      .collection("books")
      .updateOne({ _id: borrow.bookId }, { $inc: { copies: 1 } });

    res.send({ message: "Book returned" });
  } catch (error) {
    res.status(500).send({ message: "Could not return the book" });
  }
});

const port = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`BookNook server running on port ${port}`);
    });
  })
  .catch((error: Error) => {
    console.log("MongoDB connection failed:", error.message);
    process.exit(1);
  });
