const request = require("supertest");

const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Cloud Media Storage API is running"
  });
});

describe("Cloud Media Storage API", () => {

  test("GET / should return API running message", async () => {

    const response = await request(app)
      .get("/");

    expect(response.statusCode).toBe(200);

    expect(response.body.message)
      .toBe("Cloud Media Storage API is running");
  });

});