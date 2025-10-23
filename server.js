// ---------- Imports ----------
// ---------- Imports ----------
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

// ---------- Configurations ----------
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());


// ---------- MongoDB Connection ----------
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in environment variables");
  process.exit(1);
}

let db, ordersCollection, reservationsCollection;

async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db("restaurant");
    ordersCollection = db.collection("orders");
    reservationsCollection = db.collection("reservations");
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}
connectDB();

// ---------- ROUTES ----------

// ✅ Fetch all orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await ordersCollection.find({}, { projection: { _id: 0 } }).toArray();
    res.json(orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ Fetch all reservations
app.get("/api/reservations", async (req, res) => {
  try {
    const reservations = await reservationsCollection.find({}, { projection: { _id: 0 } }).toArray();
    res.json(reservations);
  } catch (error) {
    console.error("❌ Error fetching reservations:", error);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

// ✅ Fetch stats (total orders, confirmed, delivered, revenue)
app.get("/api/stats", async (req, res) => {
  try {
    const totalOrders = await ordersCollection.countDocuments({});
    const confirmedOrders = await ordersCollection.countDocuments({ "items.status": "confirmed" });
    const deliveredOrders = await ordersCollection.countDocuments({ "items.status": "delivered" });

    // Calculate total revenue
    const orders = await ordersCollection.find({}).toArray();
    const revenue = orders.reduce((acc, order) => {
      const orderTotal = (order.items || []).reduce((sum, item) => {
        const price = item.price || 0;
        const qty = item.quantity || 1;
        return sum + price * qty;
      }, 0);
      return acc + orderTotal;
    }, 0);

    res.json({
      total_orders: totalOrders,
      confirmed_orders: confirmedOrders,
      delivered_orders: deliveredOrders,
      revenue,
    });
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ✅ Create a new order
app.post("/api/orders", async (req, res) => {
  try {
    const { phone, items, name, address, caller_phone } = req.body;

    let finalPhone = phone && phone !== "unknown" ? phone : `call_${Date.now()}`;
    const order = {
      phone: finalPhone,
      items: items || [],
      status: "confirmed",
      created_at: new Date().toISOString(),
      order_type: "phone_only",
      ...(name && { name }),
      ...(address && { address }),
      ...(caller_phone
        ? { caller_phone, phone_source: "extracted_from_call" }
        : { phone_source: "provided_by_customer" }),
    };

    const result = await ordersCollection.insertOne(order);
    res.json({ message: "Order created successfully", order });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ✅ Get the most recent order by phone
app.get("/api/orders/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const order = await ordersCollection
      .find({ phone })
      .sort({ _id: -1 })
      .limit(1)
      .toArray();

    if (!order.length) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order[0]);
  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// ---------- Start Server ----------
// const PORT = process.env.PORT || 8000;
// app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

module.exports = app;
