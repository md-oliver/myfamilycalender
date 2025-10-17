// import ejs from "ejs";

import express from "express";
import sqlite3 from "sqlite3";

const app = express();
const PORT = 4059;

const db = new sqlite3.Database("./server/calender.db");

app.use(express.static("public"));
app.set("view engine", "ejs");

const getMonths = (req, res, next) => {
	db.all("SELECT DISTINCT month FROM birthdays", (err, rows) => {
		if (err) return next(err);

		req.months = rows;
		next();
	});
};

const getCategory = (req, res, next) => {
	db.all("SELECT DISTINCT category FROM birthdays", (err, rows) => {
		if (err) return next(err);

		req.categories = rows;
		next();
	});
};

app.get("/", getMonths, getCategory, (req, res, next) => {
	db.all("SELECT * FROM birthdays;", (err, results) => {
		if (err) {
			console.log(err.message);
		}

		if (results) {
			res.status(200).render("home.ejs", {
				data: results,
				months: req.months,
				categories: req.categories,
			});
		}
	});
});

app.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});
