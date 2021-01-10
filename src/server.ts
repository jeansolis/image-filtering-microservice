import * as jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import express, { NextFunction, Request, Response } from "express";
import { config } from "./config/config";
import {
  deleteLocalFiles,
  filterImageFromURL,
  isValidImageUrl,
} from "./util/util";

interface GetFilteredImageQueryParams {
  image_url: string
}

(async () => {
  // Init the Express application
  const app = express();
  // Set the network port
  const port = process.env.PORT || 8082;

  // Middleware to validade Authorization Header with Bearer Token.
  // HEADERS
  //    authorization: Bearer {{token}}
  const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.headers || !req.headers.authorization) {
      return res.status(401).send({ message: "No authorization headers." });
    }
    const token_bearer = req.headers.authorization.split(" ");
    if (token_bearer.length != 2) {
      return res.status(401).send({ message: "Malformed token." });
    }

    const token = token_bearer[1];

    return jwt.verify(token, config.jwt.secret, (err) => {
      if (err) {
        return res
          .status(500)
          .send({ auth: false, message: "Failed to authenticate." });
      }
      return next();
    });
  };

  // Use the body parser middleware for post requests
  app.use(bodyParser.json());

  // GET /filteredimage?image_url={{URL}}
  // endpoint to filter an image from a public url.
  // QUERY PARAMATERS
  //    image_url: URL of a publicly accessible image
  // RETURNS
  //    the filtered image file
  app.get(
    `/filteredimage`,
    requireAuth,
    async (req, res) => {
      const { image_url } : GetFilteredImageQueryParams = req.query;

      if (!image_url) {
        return res.status(400).send({
          errors: [
            {
              message:
                "image_url not provided. Try GET /filteredimage?image_url={{}}",
            },
          ],
        });
      }

      if (!isValidImageUrl(image_url)) {
        return res.status(422).send({
          errors: [
            {
              message:
                "provided url doesn't seem to have a supported file extension. Accepted image formats are [bmp|gif|jpeg|jpg|png|tiff]",
            },
          ],
        });
      }

      let filteredImage: string;
      try {
        filteredImage = await filterImageFromURL(image_url);
      } catch (error) {
        return res.status(422).send({
          errors: [
            {
              message: `image could not be processed. ${error.message}`,
            },
          ],
        });
      }
      res.on("finish", async () => {
        deleteLocalFiles([filteredImage]);
      });
      return res.sendFile(filteredImage);
    }
  );

  // Root Endpoint
  // Displays a simple message to the user
  app.get("/", async (req, res) => {
    res.send("try GET /filteredimage?image_url={{}}");
  });

  // Start the Server
  app.listen(port, () => {
    console.log(`server running http://localhost:${port}`);
    console.log(`press CTRL+C to stop server`);
  });
})();
