require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//middleware
app.use(cors());
// app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

//Verify token function:
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

//MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hy2si.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    await client.connect();
    const toolsCollection = client
      .db("AudioBitManufacturer")
      .collection("tools");
    const orderCollection = client
      .db("AudioBitManufacturer")
      .collection("orders");
    const reviewCollection = client
      .db("AudioBitManufacturer")
      .collection("reviews");
    const userCollection = client
      .db("AudioBitManufacturer")
      .collection("users");
    const paymentCollection = client
      .db("AudioBitManufacturer")
      .collection("payments");
    const blogsCollection = client
      .db("AudioBitManufacturer")
      .collection("blogs");
    //Payment api
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const order = req.body;
        const price = order.totalPrice;
        const amount = price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.log(error);
      }
    });
    //Api for jwt token
    app.post("/login", async (req, res) => {
      try {
        const email = await req.body;
        const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET);
        res.send({ token: token });
      } catch (error) {
        console.log(error);
      }
    });
    //Api for verify admin
    const verifyAdmin = async (req, res, next) => {
      try {
        const requester = req.decoded.email;
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          next();
        } else {
          res.status(403).send({ message: "Forbidden Access" });
        }
      } catch (error) {
        console.log(error);
      }
    };
    //post tool in database
    app.post("/tools", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const newTool = req.body;
        const result = await toolsCollection.insertOne(newTool);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // Get tools for manage
    app.get("/manageTools", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const query = {};
        const result = await toolsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Get tools from database
    app.get("/tools", async (req, res) => {
      try {
        const size = parseInt(req.query.size);
        const query = {};
        const cursor = toolsCollection.find(query);
        let tools;
        if (size) {
          tools = await (await cursor.limit(size).toArray()).reverse();
        } else {
          tools = await (await cursor.toArray()).reverse();
        }
        res.send(tools);
      } catch (error) {
        console.log(error);
      }
    });
    // Update single tool for update
    app.put("/tools/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;
        const filter = { _id: ObjectId(id) };
        const updateDoc = { $set: data };
        const option = { upsert: true };
        const result = await toolsCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    app.put("/tool/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;
        // console.log(data);
        const filter = { _id: ObjectId(id) };
        const updateDoc = { $set: { quantity: data.quantity } };
        const option = { upsert: true };
        const result = await toolsCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Get single tool from database
    app.get("/tools/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: ObjectId(id) };
        const result = await toolsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Delete single tool from database
    app.delete("/tools/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: ObjectId(id) };
        const result = await toolsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // Get user order from client side and post in database
    app.post("/orders", verifyJWT, async (req, res) => {
      try {
        const newOrder = req.body;
        const result = await orderCollection.insertOne(newOrder);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Get all orders
    app.get("/orders", async (req, res) => {
      try {
        const query = {};
        const result = await orderCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Change shipping status Api
    app.put("/orders/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;
        const filter = { _id: ObjectId(id) };
        const updateDoc = { $set: data };
        const option = { upsert: true };
        const result = await orderCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // Get orders collection for user from database
    app.get("/userOrders", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
        // console.log(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Api for single order
    app.get("/userOrder/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: ObjectId(id) };
        const result = await orderCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //update user order by id for payment info update
    app.patch("/userOrders/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const payment = req.body;
        const filter = { _id: ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "paid",
            transactionId: payment.transactionId,
          },
        };
        const result = await paymentCollection.insertOne(payment);
        const updatedOrder = await orderCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(updatedDoc);
      } catch (error) {
        console.log(error);
      }
    });
    //Delete order api
    app.delete("/userOrders/:id", async (req, res) => {
      try {
        const id = req.params;
        const query = { _id: ObjectId(id) };
        const result = await orderCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // post api for user review
    app.post("/review", async (req, res) => {
      try {
        const newReview = req.body;
        const result = await reviewCollection.insertOne(newReview);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // Get api for getting reviews of users
    app.get("/review", async (req, res) => {
      try {
        const query = {};
        const result = await (
          await reviewCollection.find(query).toArray()
        ).reverse();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    /* ++++++++++++++++ */
    app.put("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = req.body;
        const filter = { email: email };
        // ++++++++
        const options = { upsert: true };
        const updatedDoc = {
          $set: user,
        };
        const result = await userCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // ++++++++
    // if (!filter) {
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: user,
    //   };
    //   const result = await userCollection.updateOne(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result)
    // }
    //   res.send({ message: "Account available" });
    // };);
    /* ++++++++++++++++ */
    // Get user info from database
    app.get("/users", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Update user info Api
    app.put("/users/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;
        const filter = { _id: ObjectId(id) };
        const updateDoc = { $set: data };
        const option = { upsert: true };
        const result = await userCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Api for get admin
    app.get("/admin", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // Get users for admin
    app.get("/makeAdmin", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const query = {};
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Make admin Api
    app.post("/makeAdmin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;
        const filter = { _id: ObjectId(id) };
        const updateDoc = { $set: data };
        const option = { upsert: true };
        const result = await userCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Blogs post api
    app.post("/blogs", async (req, res) => {
      try {
        const blog = req.body;
        const result = await blogsCollection.insertOne(blog);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    //Blogs get api
    app.get("/blogs", async (req, res) => {
      try {
        const query = {};
        const result = await blogsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
  } finally {
  }
}
run().catch(console.dir);

//Test purpose api
app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.listen(port, () => {
  console.log(`Listening from port http://localhost:${port}`);
});
