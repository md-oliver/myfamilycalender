import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import env from "dotenv";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pg from "pg";

env.config();

const app = express();
const PORT = process.env.PORT || 4059;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
	session({
		secret: process.env.SESSION_KEY,
		resave: true,
		saveUninitialized: true,
	}),
);

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Pool({
	user: process.env.PG_USER,
	host: process.env.PG_HOST,
	database: process.env.PG_DATABASE,
	password: process.env.PG_PASSWORD,
	port: process.env.PG_PORT,
});

// Helper functions (replace with your actual implementations)
async function findUserByUsername(username) {
	const user = await db.query("SELECT * FROM users WHERE username = $1", [
		username,
	]);
	return user.rows[0];
}

async function findUserById(id) {
	const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);
	return user.rows[0];
}

passport.use(
	new LocalStrategy(async (username, key, done) => {
		try {
			// 1. Find the user in your database
			const user = await findUserByUsername(username);

			// 2. If user not found, return an error
			if (!user) {
				return done(null, false, { message: "Incorrect username." });
			}

			// 3. Compare the provided password with the stored password
			const passwordMatch = await bcrypt.compare(key, user.key);

			// 4. If passwords do not match, return an error
			if (!passwordMatch) {
				return done(null, false, { message: "Incorrect login details." });
			}

			// 5. If authentication is successful, return the user object
			return done(null, user);
		} catch (err) {
			// 6. Handle any errors during the process
			return done(err);
		}
	}),
);

// Serialize user into the session
passport.serializeUser((user, done) => {
	done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
	try {
		// Find the user by ID
		const user = await findUserById(id);

		done(null, user);
	} catch (err) {
		done(err);
	}
});

const getMonths = async (req, res, next) => {
	const monthQuery = "SELECT DISTINCT month FROM birthdays;";

	try {
		const result = await db.query(monthQuery);

		if (result) {
			const monthOrder = {
				January: 1,
				February: 2,
				March: 3,
				April: 4,
				May: 5,
				June: 6,
				July: 7,
				August: 8,
				September: 9,
				October: 10,
				November: 11,
				December: 12,
			};

			const sortedMonths = result.rows.sort((a, b) => {
				return monthOrder[a.month] - monthOrder[b.month];
			});

			req.months = sortedMonths;
			next();
		}
	} catch (error) {
		return next(error.message);
	}
};

const getCategory = async (req, res, next) => {
	const catQuery = "SELECT DISTINCT category FROM birthdays;";

	try {
		const result = await db.query(catQuery);

		if (result) {
			req.category = result.rows;
			next();
		}
	} catch (error) {
		return next(error.message);
	}
};

app.get("/", getMonths, getCategory, async (req, res, next) => {
	const homeQuery = "SELECT * FROM birthdays";

	try {
		const result = await db.query(homeQuery);

		if (result.rowCount > 0) {
			res.status(200).render("home.ejs", {
				data: result.rows,
				months: req.months,
				categories: req.categories,
			});
		} else {
			res.status(404).render("home.ejs", {
				data: null,
			});
		}
	} catch (error) {
		res.status(500).send({
			status: "Failed",
			message: error.message,
		});
	}
});

app.post("/register", async (req, res) => {
	const { username, password } = req.body;
	try {
		const existingUser = await db.query(
			"SELECT * FROM users WHERE username = $1;",
			[username],
		);
		if (existingUser.rowCount > 0) {
			return res.status(400).json({ message: "Username already exists." });
		}

		// const salt = await bcrypt.genSalt(14);
		const hash = await bcrypt.hash(password, 14);
		const newUserQuery = "INSERT INTO users (username, key) VALUES ($1, $2);";
		await db.query(newUserQuery, [username, hash]);

		// Optionally, log the user in automatically after registration
		// const newUser = await db.query('SELECT * FROM users WHERE username = $1;', [username]);
		// req.login(newUser.rows[0], (err) => {
		//     if (err) return res.status(500).json({ message: 'Login failed.' });
		//     return res.redirect('/profile'); // Redirect to profile or another page
		// });

		res.redirect("/");
		//res.status(201).json({ message: 'User registered successfully!' }); //alternate
	} catch (error) {
		// TODO: render error page to render new page for error handling;
		console.log(error.message);

		res.status(error.status || 500).send("An error has occured");
		//res.status(500).json({ message: 'An error occurred during registration.' }); //alternate
	}
});

app.get("/profile", (req, res) => {
	if (req.isAuthenticated()) {
		res.render("profile", { message: "Welcome!" });
	} else {
		res.redirect("/");
	}
});

// // Define your routes
// app.post(
// 	"/login",
// 	passport.authenticate("local", {
// 		successRedirect: "/profile", // Redirect on successful login
// 		failureRedirect: "/", // Redirect on failed login
// 		// failureFlash: true, // Enable flash messages for failure
// 	}),
// );

app.post(
	"/login",
	passport.authenticate("local", { failureRedirect: "/" }),
	(req, res) => {
		res.redirect("profile");
	},
);

// app.post("/login", verifyUser, async (req, res, next) => {
// 	if (!req.username) {
// 		console.log("User does not exist");
// 		return res.redirect("/");
// 	}

// 	try {
// 		const { password } = req.body;

// 		const userQuery = "SELECT username, key FROM users WHERE username = $1";
// 		const resultQuery = await db.query(userQuery, [req.username]);

// 		if (resultQuery.rowCount > 0) {
// 			const databasePassword = resultQuery.rows[0].key;
// 			const matchedPassword = await bcrypt.compare(password, databasePassword);

// 			if (!matchedPassword) {
// 				throw new Error("Invalid username and/or password");
// 			}
// 		}

// 		res.status(200).redirect("/profile");
// 	} catch (error) {
// 		console.log(error.message);

// 		res.status(error.status || 500).send("Eror has occured");
// 	}
// });

app.post("/logout", (req, res, next) => {
	req.logout((err) => {
		if (err) {
			return next(err);
		}
	});

	res.redirect("/");
});

app.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});
