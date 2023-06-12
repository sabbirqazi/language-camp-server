const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-fbs5ud0-shard-00-00.y4xsfw0.mongodb.net:27017,ac-fbs5ud0-shard-00-01.y4xsfw0.mongodb.net:27017,ac-fbs5ud0-shard-00-02.y4xsfw0.mongodb.net:27017/?ssl=true&replicaSet=atlas-hb80nr-shard-0&authSource=admin&retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    /* await client.connect(); */
    // Send a ping to confirm a successful connection
    const classCollection = client.db("languageDB").collection("classes");
    const instructorCollection = client
      .db("languageDB")
      .collection("instructors");
    const userCollection = client.db("languageDB").collection("users");
    const myClassCollection = client.db("languageDB").collection("myClass");
    const paymentCollection = client.db("languageDB").collection("payments");
    // TODO: remove instructor collection and fetch the instructor from class collection
    // instructor related api

    //post the instructors class
    app.post("/addclass", async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });
    //instructor specific data
    app.get("/instructorclasses", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await classCollection.find(query).toArray();

      res.send(result);
    });

    // user related api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/postmyclass", async (req, res) => {
      const myClass = req.body;
      const result = await myClassCollection.insertOne(myClass);
      res.send(result);
    });


    //student selected class
    app.get("/myclasses", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await myClassCollection.find(query).toArray();
      res.send(result);
    });
    //getting the price for payment api
    app.get("/myclasses/:classId", async (req, res) => {
      const classId = req.params.classId;
      // Validate the id parameter
      /*     if (!ObjectId.isValid(id)) {
        return res.status(400).send("Invalid ID format");
      } */
      const query = { classId: classId };
      const result = await myClassCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    // admin related api
    //approve  class
    app.patch("/classes/manageclasses/approve/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //deny  class and send feedback
    app.patch("/classes/manageclasses/deny/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const feedbackText = req.body;
      const updateDoc = {
        $set: {
          status: "denied",
          feedback: feedbackText.feedbackText,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // checking is Admin for dashboard
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // checking is instructor for dashboard
    app.get("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/myclasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await myClassCollection.deleteOne(query);
      res.send(result);
    });
    // class related api
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    //instructors page api
    app.get("/users/instructor", async (req, res) => {
      const result = await userCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(result);
    });

    //payment related api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "aud",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //payment api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const insertResult = await paymentCollection.insertOne(payment);    
      const query = { _id: new ObjectId(payment.classId) };
      console.log(query);
      //class and my class different
      const queryClass = { classId: payment.classId };
      const deleteResult = await myClassCollection.deleteOne(queryClass)
      ;
     const classinfo = await classCollection.findOne(query);
     const newSeat = parseFloat(classinfo?.availableSeats) - 1;
     const newStudents = parseFloat(classinfo?.students) +1;
     const updateSeat = {
                   $set:{ availableSeats: newSeat, 
                          students: newStudents
                  }

                   
     }
     const updateClassSeat = await classCollection.updateOne(query, updateSeat);
      res.send({ insertResult, deleteResult });
    });
    //payment history api
    app.get("/payments/history", async (req, res) =>{
      const email = req.query.email;
      const query = { email: email };
    /*   const result = await myClassCollection.find(query).toArray();
      res.send(result); */
      const result = await paymentCollection.find(query).sort({ _id: -1 }).toArray();
      res.send(result);
    })
    //enrolled class api
    app.get("/payments/enrolledclass", async (req, res) =>{
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    /* await client.close(); */
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Lango camp server running");
});

app.listen(port, () => {
  console.log(`LangoCamp Server is running on port: ${port}`);
});
