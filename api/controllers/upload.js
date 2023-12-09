
import fs from "fs";
import stream from "stream";

export const uploadImage = ((req, res) => {
  const file = req.file;
  res.status(200).json(file.filename);
});

export const getImage = ((req, res) => {
  const filePath = `../api/upload/images/${req.params.id}`;
  const readbleStream = fs.createReadStream(filePath);
  const ps = new stream.PassThrough();
  stream.pipeline(readbleStream, ps, (err) => {
    if (err) {
      console.log(err);
      return res.status(400).send("400 Bad request");
    }
  });
  ps.pipe(res);
});
