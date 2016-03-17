/* This function is used to deobfuscate the score and level values
 * and do some validations about the score. 
 *
 * While the logic here is fairly simplistic, you could expand this 
 * to be much more powerful and harder to bypass. However, keep 
 * in mind that there is no full proof way to do this. 
 */
Parse.Cloud.define("submitHighscore", function(request, response) {
  // We use the master key to bypass the class level restrictions
  Parse.Cloud.useMasterKey()
  
  // Get the logged in player
  var player = request.user;

  // Deobfuscate the passed data
  var scoreHash = request.params.score.split(".");
  var level = (scoreHash[0] >> 5) / 362;
  var score = (scoreHash[1] >> 4) / 672;

  // Validate that the level matches, and the score is not too high
  if (score < 1000 && (Math.floor(score/10) + 1) === level) {
    // Create highscore object
    var scoreObject = Parse.Object("HighScore");
    scoreObject.set("score", score); // set the score
    scoreObject.set("player", player); // create 1-* relationship with player

    // Save the highscore object (we use promises instead of callbacks)
    scoreObject.save().then(function() {
      response.success("submitted!");
    }, function(error) {
      response.error(error.message);
    });
  } else {
    response.error("Nice try. Maybe put your skills to good use? https://parse.com/jobs");
  }
});
