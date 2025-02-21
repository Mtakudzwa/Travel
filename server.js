require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient } = require("mongodb");

const PORT = 5000;
const SECRET_KEY = process.env.SECRET_KEY;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB
let db;
MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        console.log("✅ Connected to MongoDB");
        db = client.db();
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Serve static files from the 'public' directory
const serveFile = (res, filePath, contentType) => {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("404 Not Found");
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname } = parsedUrl;

    // Serve static files from 'public' directory
    if (pathname === "/" || pathname === "/index.html") return serveFile(res, "public/index.html", "text/html");
    if (pathname === "/login.html") return serveFile(res, "public/login.html", "text/html");
    if (pathname === "/dashboard.html") return serveFile(res, "public/dashboard.html", "text/html");

    if (pathname.startsWith("/public/")) {
        const ext = path.extname(pathname);
        const contentType = {
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
        }[ext] || "text/plain";

        return serveFile(res, pathname.substring(1), contentType);
    }

    // API Endpoint - User Signup
    if (pathname === "/api/signup" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => (body += chunk.toString()));
        req.on("end", async () => {
            try {
                const { name, email, password } = JSON.parse(body);

                const existingUser = await db.collection("users").findOne({ email });
                if (existingUser) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ message: "User already exists!" }));
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                await db.collection("users").insertOne({ name, email, password: hashedPassword });

                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "Signup successful! Please log in." }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "Invalid request" }));
            }
        });
    }

    // API Endpoint - User Login
    if (pathname === "/api/login" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => (body += chunk.toString()));
        req.on("end", async () => {
            try {
                const { email, password } = JSON.parse(body);

                const user = await db.collection("users").findOne({ email });
                if (!user || !(await bcrypt.compare(password, user.password))) {
                    res.writeHead(401, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ message: "Invalid email or password" }));
                }

                // Generate JWT token
                const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: "1h" });

                res.writeHead(200, {
                    "Content-Type": "application/json",
                    "Set-Cookie": `token=${token}; HttpOnly; Path=/`
                });
                res.end(JSON.stringify({ message: "Login successful!", token }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "Invalid request" }));
            }
        });
    }

    //API ENDPOINT - destination
    if (pathname === "/api/destinations" && req.method === "GET") {
        const destinations = [
            { id: 1, name: "Rome, Italy", price: "$5.42k", duration: "10 Days Trip", image: "/public/img/dest/dest1.jpg" },
            { id: 2, name: "London, UK", price: "$4.2k", duration: "12 Days Trip", image: "/public/img/dest/dest2.jpg" },
            { id: 3, name: "Full Europe", price: "$15k", duration: "28 Days Trip", image: "/public/img/dest/dest3.jpg" },
            { id: 4, name: "Bali, Indonesia", price: "$3.8k", duration: "7 Days Trip", image: "/public/img/dest/dest4.jpg" },
            { id: 5, name: "Paris, France", price: "$6.5k", duration: "14 Days Trip", image: "/public/img/dest/dest5.jpg" },
            { id: 6, name: "Tokyo, Japan", price: "$7k", duration: "9 Days Trip", image: "/public/img/dest/dest6.jpg" }
        ];
    
        // Shuffle and return a random subset of 3 destinations
        const shuffled = destinations.sort(() => 0.5 - Math.random());
        const randomDestinations = shuffled.slice(0, 3);
    
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(randomDestinations));
    }    


    // API Endpoint - User Logout
    if (pathname === "/api/logout" && req.method === "GET") {
        res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": "token=; HttpOnly; Path=/; Max-Age=0"
        });
        res.end(JSON.stringify({ message: "Logged out successfully!" }));
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
});

// Start Server
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
