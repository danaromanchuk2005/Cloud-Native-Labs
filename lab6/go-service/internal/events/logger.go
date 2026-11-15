package events

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type EventRecord struct {
	Type      string `json:"type" bson:"type"`
	Payload   any    `json:"payload" bson:"payload"`
	Timestamp string `json:"timestamp" bson:"timestamp"`
}

type MongoEventLogger struct {
	col *mongo.Collection
}

func NewMongoEventLogger(db *mongo.Database) *MongoEventLogger {
	if db == nil {
		return &MongoEventLogger{}
	}
	return &MongoEventLogger{col: db.Collection("events")}
}

func (l *MongoEventLogger) Log(ctx context.Context, eventType string, payload any) error {
	if l.col == nil {
		return nil
	}
	_, err := l.col.InsertOne(ctx, EventRecord{
		Type:      eventType,
		Payload:   payload,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
	return err
}

func (l *MongoEventLogger) GetRecent(ctx context.Context, limit int64) ([]EventRecord, error) {
	if l.col == nil {
		return []EventRecord{}, nil
	}
	opts := options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(limit)
	cur, err := l.col.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var events []EventRecord
	if err := cur.All(ctx, &events); err != nil {
		return nil, err
	}
	return events, nil
}