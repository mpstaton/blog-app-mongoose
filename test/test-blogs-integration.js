const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server')
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function seedBlogPostData() {
  console.info('seeding blog post data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogPostData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}
/*
function generateAuthor() {
	const authors = ['Mark Twain', 'Aldous Huxley', 'Charles Dickens', 'Daniel Boorstin'];
	return authors[Math.floor(Math.random() * authors.length)];
}
*/

function generateBlogPostData() {
  return {
 //need to generate ids
    author: {
    	firstName: faker.name.firstName(),
    	lastName: faker.name.lastName()
    },
    title: faker.lorem.sentence(),
    content: faker.lorem.text(),
    created: faker.date.past(),
  }
}

function tearDownDb() {
  return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
      .then(result => resolve(result))
      .catch(err => reject(err))
  });
}

describe('BlogPost API resource', function() {
	before(function() {
		return runServer(TEST_DATABASE_URL);
	});
	beforeEach(function() {
		return seedBlogPostData();
	});
	afterEach(function() {
		return tearDownDb();
	});
	after(function() {
		return closeServer();
	})

	describe('GET endpoint', function() {

		it('should return all BlogPosts', function() {
			let res;
			return chai.request(app)
				.get('/posts')
				.then(function(_res) {
					res = _res;
					res.should.have.status(200);
					res.body.should.have.length.of.at.least(1);
					return BlogPost.count();
				})
				.then(function(count) {
					res.body.should.have.length.of(count);
				});
		});

		it('should return BlogPosts with the right fields', function() {
			let resPost;
			return chai.request(app)
				.get('/posts')
				.then(function(res) {
					res.should.have.status(200);
					res.should.be.json;
					res.body.should.be.a('array');
					res.body.should.have.length.of.at.least(1);

					res.body.forEach(function(post) {
						post.should.be.a('object');
						post.should.include.keys(
							'id', 'title', 'content', 'author', 'created');
					});
					resPost = res.body[0];
					return BlogPost.findById(resPost.id).exec();
				})
				.then(function(post) {
					resPost.author.should.equal(post.authorName);
					resPost.title.should.equal(post.title);
					resPost.content.should.equal(post.content);
				});
		});
	});

	describe('POST endpoint', function() {

		it('should add a new BlogPost', function() {
      const newPost = generateBlogPostData();
      let mostRecentPost;

      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'author', 'content', 'created');
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;
          res.body.title.should.equal(newPost.title);
          res.body.author.should.equal(
          	`${newPost.author.firstName} ${newPost.author.lastName}`);
          res.body.content.should.equal(newPost.content);
          return BlogPost.findById(res.body.id).exec();
        })
        .then(function(post) {
          post.author.should.equal(newPost.author);
          post.title.should.equal(newPost.title);
          post.content.should.equal(newPost.content);
          post.created.should.equal(newPost.created);
        });

		});
	});

	describe('PUT endpoint', function() {

		it('should update fields you send over', function() {
			const updateData = {
				title: 'Updated Blog Post',
				author: {
					firstName: 'Kermit', 
					lastName: 'the Updater'
				}
			};

			return BlogPost
				.findOne()
				.exec()
				.then(function(post) {
					updateData.id = post.id

					return chai.request(app)
						.put(`/posts/${post.id}`)
						.send(updateData);
				})
				.then(function(res) {
					res.should.have.status(201);
					res.should.be.json;
					res.body.should.be.a('object');
					res.body.title.should.equal(updateData.title);
					res.body.author.should.equal(
          	`${updateData.author.firstName} ${updateData.author.lastName}`);
					return BlogPost.findById(updateData.id).exec();
				})
				.then(function(post) {
					post.title.should.equal(updateData.title);
					post.author.firstName.should.equal(updateData.author.firstName);
					post.author.lastName.should.equal(updateData.author.lastName);
				});
		});
	});

		describe('DELETE endpoint', function() {

		it('should delete a BlogPost by id', function() {

			let post;

			return BlogPost
				.findOne()
				.exec()
				.then(function(_post) {
					post = _post;
					return chai.request(app).delete(`/posts/${post.id}`);
				})
				.then(function(res) {
					res.should.have.status(204);
					return BlogPost.findById(post.id).exec();
				})
				.then(function(_post) {
					should.not.exist(_post);
				});
		});
	});
});


