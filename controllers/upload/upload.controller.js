



exports.uploadAws = async (req, res, next) => {
  try {
    console.log("come here");

    res.send("OK")

  } catch (error) {
    next(error)
  }
}

