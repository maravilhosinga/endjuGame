$(function(){

  /* == Entry Point ==
   * This is the main entry point to the game, it
   * initialializes all necessary elements to run the game */
  var Game = {
    initialize: function() {
      if (Utils.isSupported()) {
        // Create the model
        var model = new GameState();
        
        // Create the stage
        new Stage({model: model}).render();

        // Create all the scenes
        new MenuScene({model: model});
        new GameScene({model: model});
        new GameOverScene({model: model});
        new HighscoreScene({model: model});
        new CreditsScene({model: model});

        // Display the menu
        model.set("scene", "menu");

        // disable dragging and selecting actions
        $("#stage").on("dragstart selectstart", "*", function(event) { return false; });

        // disable scrolling on smartphones
        document.ontouchmove = function(e) { e.preventDefault(); };
      } else {
        $("#unsupported").show();
      }
    }
  };


  /***** Models *****/

  /* == Game State =
   * This model is transient and represents the state of the
   * game. It is used to facilitate communication between the views,
   * especially changing scenes and sharing game stats (score, 
   * level, etc). */
  var GameState = Backbone.Model.extend({
    defaults: {
      scene: "",
      eggCollection: null,
      speedX: 1
    },

    initialize: function() {
      _.bindAll(this);
      
      // This collection will store the egg models when they are on screen
      this.set("eggCollection", new Backbone.Collection());

      // This collection is used in the highscore page to facilitate the query to Parse
      var query = new Parse.Query("HighScore");
      query.descending("score");
      query.include("player");
      query.limit(10);
      this.set("highscoreCollection", query.collection());

      // Initialize the game data (score, level, etc)
      this.resetGameData();

      // Events to manage th game data
      this.get("eggCollection").on("fly", this.incrementScore);
      this.get("eggCollection").on("break", this.decrementLife);
      this.get("eggCollection").on("fly break", this.cleanUpEgg);
      this.get("eggCollection").on("remove", this.incrementLevel);
    },

    /* Increases the user's score by 1 */
    incrementScore: function() {
      this.set("score", this.get("score") + 1);
    },

    /* Decreases the user's lives by 1 */
    decrementLife: function() {
      this.set("lives", this.get("lives") - 1);
      this.validateAlive();
    },

    /* Increment the user's level by 1 and increases speed multiplier */
    incrementLevel: function() {
      if (this.get("eggCollection").length <= 0) {
        this.set("level", this.get("level")+1);
        this.set("speedX", this.get("speedX")+0.25);
        this.addEggs();
      }
    },

    /* Checks if the user is still alive. If not, changes scene. */
    validateAlive: function() {
      if (this.get("lives") <= 0) {
        this.set("scene", "game_over");
      }
    },

    /* Add 10 eggs for the current level */
    addEggs: function() {
      var numEggs = 10;
      for (var i = 0; i < numEggs; i++) {
        this.get("eggCollection").add(new EggModel({
          collectionIndex: i
        }));
      }
    },

    /* Remove broken or saved eggs from the model */
    cleanUpEgg: function(eggModel) {
      this.get("eggCollection").remove(eggModel);
    },

    /* Resets the game's data (score, level, etc) for a new game */
    resetGameData: function() {
      this.set(GameState.DefaultGameData);
    },

    /* We hash the score before sending it to Cloud Code. This is an 
       efficient way to secure your highscore (though nothing is full proof) */
    getScoreSubmission: function() {
      return ((this.get("level") * 362) << 5) + "." + ((this.get("score") * 672) << 4);
    }
  }, {
    /* The default game data used for a new game */
    DefaultGameData: {
      score: 0,
      lives: 3,
      level: 1,
      speedX: 1
    }
  });
  
  /* == Egg Model ==
   * Model used to back an Egg View. Manage the sprite and current
   * state of each egg. */
  var EggModel = Backbone.Model.extend({
    defaults: {
      spriteIndex: 1,
      collectionIndex: 0
    },

    initialize: function() {
      _.bindAll(this);
    },

    /* Increases the .png index to show the new sprite image */
    nextSprite: function() {
      // increment
      this.set("spriteIndex", this.get("spriteIndex") + 1);
      if (this.isSafe()) { // check if new sprite is safe
        this.trigger("fly", [this]); // trigger success event
      }
    },

    /* Checks if the egg is currently broken (at last sprite) */
    isSafe: function() {
      return this.get("spriteIndex") >= EggModel.NumSprites;
    },

    /* Event triggered when egg hits the ground */
    eggHitGround: function() {
      if (!this.isSafe()) {
        this.trigger("break", [this]); // trigger failure event
      }
    }
  }, {
    // The number of sprites for eggs
    NumSprites: 5
  });

  
  /***** Views *****/

  /* == Egg View ==
   * This view handles the rendering of eggs,
   * It is backed by it's own model. */
  var EggView = Backbone.View.extend({
    className: "egg",

    spriteClass: ".egg_sprite_",
    eggTemplate: _.template($("#_egg").html()),

    scene: null, // The scene the egg view is on

    events: {
      "webkitTransitionEnd": "handleTransitionEnded",
      "mozTransitionEnd": "handleTransitionEnded",
      "transitionend": "handleTransitionEnded"
    },

    initialize: function() {
      _.bindAll(this);
      this.scene = this.options.scene;
      this.gameState = this.options.gameState;
      this.$el.on(Utils.clickDownOrTouch(), this.nextSprite);

      this.model.on("change:spriteIndex", this.renderSprites);
      this.model.on("fly", this.renderFlying);
      this.model.on("break", this.renderBreaking);
    },

    /* Display the next sprite by delegating to the model who triggers a change event*/
    nextSprite: function() {
      if (!this.model.isSafe()) {
        this.model.nextSprite();
        return false;
      }
    },

    /* This renders the egg view by calculating the animation delay and speed and 
       appending the view to the scene. Should only be rendered at the beginning 
       of a level, not during. */
    render: function() {
      var self = this;
      this.renderSprites();

      // The intermission allows for the delay used to show the level label
      var intermission = 3.5;
      var delay;
      if (this.model.get("collectionIndex") === 1) {
        delay = intermission;
      } else {
        delay = (Math.random() * 6 + 3) / this.gameState.get("speedX") + (2 * this.model.get("collectionIndex")) + intermission; 
      }
      var speed = 100 * this.gameState.get("speedX") + Math.random() * 100 - 50; // in px/s, 100*multiplier +-50 
      var left = Math.random() * ($(window).width() - 100) + 30; // keep egg completely in window
      var top = $("#stage").height() - 220; // keep egg just above screen
      this.$el.css(Utils.bp() + "transition-delay", delay + "s");
      this.$el.css(Utils.bp() + "transition-duration", $(window).height() / speed + "s");
      this.$el.css(Utils.bp() + "transition-property", "top opacity");
      this.$el.css(Utils.bp() + "transition-timing-function", "linear");
      this.$el.css("left", left + "px");

      this.scene.append(this.$el);

      // Start animation
      Utils.nextTick(function() {
        self.$el.css("top", top + "px");
      });
    },

    /* Render the next sprite by re generating the template */
    renderSprites: function() {
      this.$el.html(this.eggTemplate({
        spriteIndex: this.model.get("spriteIndex")
      }));
    },

    /* Render the breaking state (animation of egg rolling sideways) */
    renderBreaking: function() {
      this.$el.addClass("cracked").addClass("disabled");
      this.$el.css(Utils.bp() + "transition-delay", "0s");
      this.$el.css(Utils.bp() + "transition-duration", "0.2s");
    },

    /* Render the broken state. Changes the image and fades out the egg */
    renderHidding: function() {
      this.$el.addClass("broken");
      this.$el.css(Utils.bp() + "transition-delay", "1s");
      this.$el.css(Utils.bp() + "transition-duration", "0.5s");
      this.$el.css(Utils.bp() + "transition-property", "opacity");
      this.$el.css(Utils.bp() + "transition-timing-function", "linear");
      this.$el.css("opacity", 0);
    },
    
    /* Render the flying state when the egg was clicked enough times */
    renderFlying: function() {
      this.$el.addClass("flying");
      this.$el.css(Utils.bp() + "transition-delay", "0s");
      this.$el.css(Utils.bp() + "transition-duration", "1s");
      this.$el.css(Utils.bp() + "transition-property", "top");
      this.$el.css(Utils.bp() + "transition-timing-function", "linear");
    },

    /* Remove this view from the DOM */
    renderRemove: function() {
      this.remove();
    },

    /* Handle a CSS transition ending. Based on property we identify if the
       transition was falling, breaking or hiding the egg and render the next
       state */
    handleTransitionEnded: function(e) {
      var self = this;
      if (e.originalEvent.propertyName === "opacity") { // hidding completed
        self.renderRemove();
      } else if (e.originalEvent.propertyName === "top") { // falling completed
        self.model.eggHitGround();
      } else if (e.originalEvent.propertyName === Utils.bp() + "transform" || "transform") { // breaking completed
        self.renderHidding();
      }
      return false;
    }
  });

  /* == Stage ==
   * The stage represents the background of the game. It is
   * always displayed and does not need to be added or removed
   * at any point */
  var Stage = Backbone.View.extend({
    el: "#stage",

    // Templates
    tileTemplate: _.template($("#_tile_pair").html()),
    treeTemplate: _.template($("#_tree").html()),
    sunTemplate: _.template($("#_sun").html()),
    cloudTemplate: _.template($("#_cloud").html()),

    initialize: function() {
      _.bindAll(this);
    },

    /* The render function delegates to a render function for each "element" */
    render: function() {
      this.$el.css("height",$(window).height());
      this.renderSun();
      this.renderTrees();
      this.renderTiles();
      this.renderClouds();
    },

    /* Render the ground, simply an image */
    renderTiles: function() {
      this.$(".tile").remove();
      this.$el.append(this.tileTemplate());
    },

    /* Render the sun, simply an image with a CSS keyframe */
    renderSun: function() {
      this.$(".sun").remove();
      this.$el.append(this.sunTemplate());
    },

    /* Render the trees, amount, position and image randomized based on width */
    renderTrees: function() {
      var numTrees = Math.ceil($(window).width() / 200);
      this.$(".tree").remove();
      
      // for small screens we place two trees manually
      if (numTrees <= 2) {
        this.$el.append(this.treeTemplate({ treeNum: 3, leftValue: -100 }));
        this.$el.append(this.treeTemplate({ treeNum: 1, leftValue: 120 }));
      } else {
        for (var i = 0; i < numTrees; i++) {
          var left = Math.random()*(200)+i*200;
          this.$el.append(this.treeTemplate({ treeNum: -1, leftValue: left-300 })); // -1 for treeNum tells the template to randomize
        }
      }
    },

    /* Render the floating clouds, position, amount and size randomized */
    renderClouds: function() {
      var numClouds = Math.ceil($(window).width() / 200);
      numClouds = numClouds < 2 ? 2 : numClouds;

      for (var i = 0; i < numClouds; i++) {
        var top = Math.random()*50;
        var delay = Math.random()*8-4 + (10*i); // each cloud is spaced apart by 6-14s
        var speed = 20; // in px/s
        var dir = Math.floor(Math.random()*2) < 1 ? "left" : "right";
        this.$el.append(this.cloudTemplate({ 
          delay: delay, 
          direction: dir,
          duration: $(window).width()/speed,
          topValue: top
        }));
      }
    }
  });
  
  /* == Scenes ==
   * Scenes represent screens in the game. They are added and
   * removed as the player navigates the game.
   */

  /* Scene for the main menu displayed on launch */
  var MenuScene = Backbone.View.extend({
    className: "menu_scene",
    events: {
      "animationend .title": "cleanUp",
      "webkitAnimationEnd .title": "cleanUp",
      "mozAnimationEnd .title": "cleanUp"
    },

    template: _.template($("#_menu").html()),
    sceneName: "menu", // name used to show/hide scene

    initialize: function() {
      _.bindAll(this);
      
      this.model.on("change:scene", this.renderSceneChange); // show/hide scene based on sceneName

      // Add click or touch event depending on device
      this.$el.on(Utils.clickUpOrTouch(), "#play_button", this.handlePlayButton);
      this.$el.on(Utils.clickUpOrTouch(), "#highscore_button", this.handleHighscoreButton);
      this.$el.on(Utils.clickUpOrTouch(), "#credits_button", this.handleCreditsButton);

      return this;
    },

    /* Go to "game" scene */
    handlePlayButton: function(e) {
      this.$(".menu_item").addClass("disabled");
      this.model.set("scene", "game");
      return false;
    },

    /* Go to "highscore" scene */
    handleHighscoreButton: function(e) {
      this.$(".menu_item").addClass("disabled");
      this.model.set("scene", "highscore");
      return false;
    },

    /* Go to "credits" scene */
    handleCreditsButton: function(e) {
      this.$(".menu_item").addClass("disabled");
      this.model.set("scene", "credits");
      return false;
    },

    /* Check if this scene should show or hide */
    renderSceneChange: function(model, scene) {
      if (model.previous("scene") === this.sceneName) {
        this.renderRemoveScene();
      } else if (scene === this.sceneName) {
        this.render();
      }
      return this;
    },

    /* Show this scene */
    render: function() {
      this.$el.html(this.template());
      $("#stage").append(this.$el);

      return this;
    },

    /* Hide this scene */
    renderRemoveScene: function() {
      // Setup classes for removal
      this.$(".title").removeClass("display").addClass("removal");
      this.$(".menu_item").addClass("removal");
      // Bind removal animations
      this.$(".title").css(Utils.bp() + "animation-name", "raiseTitle");
      this.$(".menu_item").css(Utils.bp() + "animation-name", "raiseMenu");

      return this;
    },

    /* After removal animation, delete from DOM */
    cleanUp: function(e) {
      if (this.model.get("scene") !== this.sceneName && $(e.target).hasClass("title")) {
        this.$el.empty();
      }
      return false;
    }
  });

  /* Scene for the game itself, displayed when "Play" is clicked */
  var GameScene = Backbone.View.extend({
    className: "game_scene",
    events: {
      "animationend": "cleanUp",
      "webkitAnimationEnd": "cleanUp",
      "mozAnimationEnd": "cleanUp"
    },

    scoreTemplate: _.template($("#_game_score").html()),
    levelTemplate: _.template($("#_game_level").html()),
    livesTemplate: _.template($("#_game_lives").html()),
    sceneName: "game",

    initialize: function() {
      _.bindAll(this);
      this.eggViews = [];

      this.$el.on(Utils.clickUpOrTouch(), ".back_button", this.handleBackButton);

      this.model.on("change:scene", this.renderSceneChange);
      this.model.get("eggCollection").on("add", this.renderAddEgg);
      this.model.on("change:score", this.renderScore);
      this.model.on("change:lives", this.renderLives);
      this.model.on("change:level", this.renderLevel);
      this.model.on("change:level", this.renderLevelLabel);
    },

    handleBackButton: function(e) {
      this.$(".back_button").addClass("disabled");
      this.model.set("scene", "menu");
    },

    renderSceneChange: function(model, scene) {
      if (model.previous("scene") === this.sceneName) {
        this.renderRemoveScene();
      } else if (scene === this.sceneName) {
        this.render();
      }
      return this;
    },

    render: function() {
      var self = this;
      // Reset game data like score, lives, etc.
      this.model.resetGameData();

      // Remove previous HUD
      this.$("#hud").remove();
      this.$el.append("<div id='hud'></div>");

      // Render templates
      this.renderLevel();
      setTimeout(function(){self.renderLevelLabel();}, 1200);
      this.renderScore();
      this.renderLives();
      this.renderBackButton();
      this.renderEggs();

      // Add to stage if necessary
      if ($("#stage ." + this.className).length <= 0) {
        $("#stage").append(this.$el);
      }

      return this;
    },
    
    renderLevel: function() {
      if (this.$("#game_level").length > 0) {
        this.$("#game_level").replaceWith(this.levelTemplate({ level: this.model.get("level") }));
      } else {
        this.$("#hud").append(this.levelTemplate({ level: this.model.get("level") }));
      }
      return this;
    },

    renderLevelLabel: function() {
      this.$el.append("<p class='level_label'>LEVEL " + this.model.get("level") + "<br>GET READY!</p>");
      setTimeout(function(){ this.$(".level_label").addClass("removal"); }, 3000);
      setTimeout(function(){ this.$(".level_label").remove(); }, 3300);
      return this;
    },

    renderScore: function() {
      if (this.$("#game_score").length > 0) {
        this.$("#game_score").replaceWith(this.scoreTemplate({ score: this.model.get("score") }));
      } else {
        this.$("#hud").append(this.scoreTemplate({ score: this.model.get("score") }));
      }
      return this;
    },    

    renderLives: function() {
      if (this.$("#game_lives").length > 0) {
        this.$("#game_lives").replaceWith(this.livesTemplate({ lives: this.model.get("lives") }));
      } else {
        this.$("#hud").append(this.livesTemplate({ lives: this.model.get("lives") }));
      }
      return this;
    },

    renderBackButton: function() {
      if (this.$(".back_button").length > 0) {
        this.$(".back_button").replaceWith("<div class='back_button'>X</div>");
      } else {
        this.$el.append("<div class='back_button'>X</div>");
      }
      return this;
    },

    renderEggs: function() {
      this.model.addEggs();
      return this;
    },

    renderAddEgg: function(eggModel, collection, options) {
      var eggView = new EggView({
        model: eggModel,
        gameState: this.model, 
        scene: this.$el
      });
      eggView.render();
      this.eggViews.push(eggView);
      return this;
    },

    renderRemoveScene: function() {
      // Animate the HUD dissapearing
      this.$(".back_button").css(Utils.bp() + "animation-name", "xRaise");
      this.$("#hud p").css(Utils.bp() + "animation-name", "removeHUD");  
      this.$(".egg").css(Utils.bp() + "transition-duration", "0.3s");

      // Remove all egg views and their models
      _.each(this.eggViews, function(eggView) {
        eggView.renderRemove();
      });
      this.model.get("eggCollection").reset();

      return this;
    },

    /* Do any remaining clean up after animations triggered
       in renderRemoveScene are completed. */
    cleanUp: function(e) {
      if (this.model.get("scene") !== this.sceneName && $(e.target).hasClass("back_button")) {
        this.$el.empty();
      }
      return false;
    }
  });

  /* Scene displayed once the player loses the game */
  var GameOverScene = Backbone.View.extend({
    className: "game_over_scene",
    events: {
      "animationend": "cleanUp",
      "webkitAnimationEnd": "cleanUp",
      "mozAnimationEnd": "cleanUp"
    },

    template: _.template($("#_game_over").html()),
    sceneName: "game_over",
    submitted: false,

    initialize: function() {
      _.bindAll(this);

      this.model.on("change:scene", this.renderSceneChange);
      this.$el.on(Utils.clickUpOrTouch(), ".menu_button", this.handleMenuButton);
      this.$el.on(Utils.clickUpOrTouch(), ".replay_button", this.handleReplayButton);
      this.$el.on(Utils.clickUpOrTouch(), ".facebook_button", this.handleFacebookButton);
    },

    handleMenuButton: function(e) {
      this.$(".menu_item").addClass("disabled");
      this.model.set("scene", "menu");
    },

    handleReplayButton: function(e) {
      this.$(".menu_item").addClass("disabled");
      this.model.set("scene", "game");
    },

    handleFacebookButton: function(e) {
      var self = this;

      $(".fb_content").hide();
      $(".facebook_button")
        .addClass("disabled")
        .empty()
        .spin({length: 5, radius: 5, lines: 8, width: 3, color: "#fff"});

      if (Parse.User.current()) {
        this.saveHighScore();
      } else {
        Parse.FacebookUtils.logIn(null, {
          success: function(user) {
            // If it's a new user, let's fetch their name from FB
            if (!user.existed()) {
              // We make a graph request
              FB.api('/me', function(response) {
                if (!response.error) {
                  // We save the data on the Parse user
                  user.set("displayName", response.name);
                  user.save(null, {
                    success: function(user) {
                      // And finally save the new score
                      self.saveHighScore();
                    },
                    error: function(user, error) {
                      console.log("Oops, something went wrong saving your name.");
                    }
                  });
                } else {
                  console.log("Oops something went wrong with facebook.");
                }
              });
            // If it's an existing user that was logged in, we save the score
            } else {
              self.saveHighScore();
            }
          },
          error: function(user, error) {
            console.log("Oops, something went wrong.");
          }
        });
      }
    },

    /* Create highscore object and save to Parse using Cloud Code */
    saveHighScore: function() {
      var self = this;

      // Generate score hash (this makes it harder for hackers to 
      // submit an arbitrarily high value)
      var submission = { score: this.model.getScoreSubmission() };

      // Submit highscore using Cloud Code
      Parse.Cloud.run('submitHighscore', submission, {
        success: function(result) {
          self.submitted = true;
          self.$(".facebook_button").html("Submitted!");
        },
        error: function(error) {
          self.submitted = true;
          self.$(".facebook_button").html(" X Try Again...").removeClass("disabled");
        }
      });
    },

    renderSceneChange: function(model, scene) {
      if (model.previous("scene") === this.sceneName) {
        this.renderRemoveScene();
      } else if (scene === this.sceneName) {
        this.render();
      }
      return this;
    },

    render: function() {
      var congratsIndex = this.model.get("level") > GameOverScene.Congrats.length ? GameOverScene.Congrats.length-1 : this.model.get("level")-1;
      this.$el.html(this.template({
        score: this.model.get("score"),
        congrats: GameOverScene.Congrats[congratsIndex]
      }));

      $("#stage").append(this.$el);      
    },

    renderRemoveScene: function() {
      // Setup classes for removal
      this.$(".menu_item").addClass("removal");
      this.$(".summary").addClass("removal");

      // Bind removal animations
      this.$(".menu_item").css(Utils.bp() + "animation-name", "raiseMenu");
      this.$(".summary").css(Utils.bp() + "animation-name", "raiseScores");
    },

    cleanUp: function(e) {
      if (this.model.get("scene") !== this.sceneName && $(e.target).hasClass("summary")) {
        this.$el.empty();
      }
    }
  }, {
    Congrats: [
      "Not bad",
      "Good",
      "Great",
      "Fantastic",
      "Smashing!",
      "Amazing!",
      "Flying High",
      "Ridiculous!",
      "Extraordinary!",
      "Monstrous!!"
    ]
  });

  /* Scene for the highscore, accessed from the menu button */
  var HighscoreScene = Backbone.View.extend({
    className: "highscore_scene",
    events: {
      "animationend": "cleanUp",
      "webkitAnimationEnd": "cleanUp",
      "mozAnimationEnd": "cleanUp"
    },

    template: _.template($("#_highscore").html()),
    scoreTemplate: _.template($("#_score").html()),
    sceneName: "highscore",

    initialize: function() {
      _.bindAll(this);

      this.model.on("change:scene", this.renderSceneChange);
      this.model.get("highscoreCollection").on("reset", this.renderScoreCollection);
      this.$el.on(Utils.clickUpOrTouch(), ".back_button", this.handleBackButton);

      if (this.model.get("currentScene") === this.sceneName) {
        this.render();
      }
    },

    handleBackButton: function(e) {
      this.$(".back_button").addClass("disabled");
      this.model.set("scene", "menu");
      return false;
    },

    renderSceneChange: function(model, scene) {
      if (model.previous("scene") === this.sceneName) {
        this.renderRemoveScene();
      } else if (scene === this.sceneName) {
        this.render();
      }
      return this;
    },

    render: function() {
      var self = this;

      // render view
      this.$el.html(this.template());

      // fetch collection
      this.model.get("highscoreCollection").fetch();
      
      // Add loading spinner
      this.$(".highscore").spin({length: 9, radius: 10, lines: 12, width: 4, color: "#fff"});

      // Add scene to the stage
      $("#stage").append(this.$el);

      return this;
    },

    renderScoreCollection: function() {
      var self = this;
      this.model.get("highscoreCollection").each(function(score, index) {
        self.renderScore(score, index);
      });
      $(".highscore .spinner").remove();
      return this;
    },

    renderScore: function(score, index) {
      this.$('#score_table tbody').append(this.scoreTemplate({
        score: score,
        index: index
      }));
    },

    renderRemoveScene: function() {
      // Setup classes for removal
      this.$(".menu_item").addClass("removal");
      this.$(".highscore").addClass("removal");

      // Bind removal animations
      this.$(".menu_item").css(Utils.bp() + "animation-name", "raiseMenu");
      this.$(".highscore").css(Utils.bp() + "animation-name", "raiseScores");
    },

    cleanUp: function(e) {
      if (this.model.get("scene") !== this.sceneName && $(e.target).hasClass("highscore")) {
        this.$el.empty();
      }
    }
  });

  /* Scene for the credits, accessed from the menu button */
  var CreditsScene = Backbone.View.extend({
    className: "credits_scene",
    template: _.template($("#_credits").html()),
    sceneName: "credits",
    events: {
      "animationend": "cleanUp",
      "webkitAnimationEnd": "cleanUp",
      "mozAnimationEnd": "cleanUp"
    },

    initialize: function() {
      _.bindAll(this);

      this.model.on("change:scene", this.renderSceneChange);
      this.$el.on(Utils.clickUpOrTouch(), ".back_button", this.handleBackButton);
    },

    handleBackButton: function(e) {
      this.$(".back_button").addClass("disabled");
      this.model.set("scene", "menu");
      return false;
    },

    renderSceneChange: function(model, scene) {
      if (model.previous("scene") === this.sceneName) {
        this.renderRemoveScene();
      } else if (scene === this.sceneName) {
        this.render();
      }
      return this; 
    },

    render: function() {
      var self = this;
      // render view
      this.$el.html(this.template());

      // Add scene to the stage
      $("#stage").append(this.$el);

      return this;
    },

    renderRemoveScene: function() {
      // Setup classes for removal
      this.$(".credits").addClass("removal");
      this.$(".back_button").addClass("removal");

      // Bind removal animations
      this.$(".credits").css(Utils.bp() + "animation-name", "raiseMenu");
      this.$(".back_button").css(Utils.bp() + "animation-name", "raiseMenu");
    },

    cleanUp: function(e) {
      if (this.model.get("scene") !== this.sceneName && $(e.target).hasClass("credits")) {
        this.$el.empty();
      }
    }
  });

  // Let's go!
  Game.initialize();
});


/* == Utils ==
 * Various utility functions used throughout */
var Utils = {

  /* Generates the appropriate css browser prefix */
  bp: function() {
    var bp = "";
    if ($.browser.webkit) {
      bp = "-webkit-";
    } else if ($.browser.mozilla) {
      bp = "-moz-";
    }
    return bp;
  },

  isSupported: function() {
    return !($.browser.msie && parseInt($.browser.version) < 10)
  },

  /* Executes the function on the next tick. This means
   * it will run after the current execution flow is completed */
  nextTick: function(func) {
    setTimeout(func, 0);
  },

  /* Generates a touch or click up event name based on the device */
  clickUpOrTouch: function(func) {
    return 'ontouchstart' in window ? "touchstart" : "mouseup";
  },

  /* Generates a touch or click down event name based on the device */
  clickDownOrTouch: function(func) {
    return 'ontouchstart' in window ? "touchstart" : "mousedown";
  }
};

/* Spin.js jQuery plugin */
$.fn.spin = function(opts) {
  this.each(function() {
    var $this = $(this),
        data = $this.data();

    if (data.spinner) {
      data.spinner.stop();
      delete data.spinner;
    }
    if (opts !== false) {
      data.spinner = new Spinner($.extend({color: $this.css('color')}, opts)).spin(this);
    }
  });
  return this;
};