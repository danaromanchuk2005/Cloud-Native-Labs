package repository

import (
	"context"
	"errors"
	"go-persistence-service/internal/apperror"
	"go-persistence-service/internal/model"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoUserDoc struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Name      string             `bson:"name"`
	Email     string             `bson:"email"`
	CreatedAt time.Time          `bson:"createdAt"`
}

type MongoUserRepository struct {
	col *mongo.Collection
}

func NewMongoUserRepository(db *mongo.Database) *MongoUserRepository {
	return &MongoUserRepository{col: db.Collection("users")}
}

func (r *MongoUserRepository) Create(ctx context.Context, name, email string) (*model.User, error) {
	doc := mongoUserDoc{
		ID:        primitive.NewObjectID(),
		Name:      strings.TrimSpace(name),
		Email:     strings.ToLower(strings.TrimSpace(email)),
		CreatedAt: time.Now().UTC(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, apperror.Conflict("email_already_exists", "User with this email already exists")
		}
		return nil, err
	}
	return &model.User{
		ID:        doc.ID.Hex(),
		Name:      doc.Name,
		Email:     doc.Email,
		CreatedAt: doc.CreatedAt,
	}, nil
}

func (r *MongoUserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, nil
	}
	var doc mongoUserDoc
	err = r.col.FindOne(ctx, bson.M{"_id": oid}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &model.User{ID: doc.ID.Hex(), Name: doc.Name, Email: doc.Email, CreatedAt: doc.CreatedAt}, nil
}

func (r *MongoUserRepository) FindAll(ctx context.Context) ([]model.User, error) {
	cur, err := r.col.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	users := []model.User{}
	for cur.Next(ctx) {
		var doc mongoUserDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		users = append(users, model.User{
			ID:        doc.ID.Hex(),
			Name:      doc.Name,
			Email:     doc.Email,
			CreatedAt: doc.CreatedAt,
		})
	}
	return users, cur.Err()
}

func (r *MongoUserRepository) Update(ctx context.Context, id, name string) (*model.User, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, nil
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var doc mongoUserDoc
	err = r.col.FindOneAndUpdate(
		ctx,
		bson.M{"_id": oid},
		bson.M{"$set": bson.M{"name": strings.TrimSpace(name)}},
		opts,
	).Decode(&doc)

	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &model.User{ID: doc.ID.Hex(), Name: doc.Name, Email: doc.Email, CreatedAt: doc.CreatedAt}, nil
}

func (r *MongoUserRepository) Delete(ctx context.Context, id string) (bool, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return false, nil
	}
	res, err := r.col.DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		return false, err
	}
	return res.DeletedCount > 0, nil
}