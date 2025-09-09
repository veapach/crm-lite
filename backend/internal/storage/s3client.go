package storage

import (
	"context"
	"io"
	"net/url"
	"os"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var s3Client *minio.Client
var s3Bucket string
var s3Enabled bool

func IsS3Enabled() bool {
	return s3Enabled
}

func InitS3FromEnv() error {
	endpoint := os.Getenv("S3_URL")
	bucket := os.Getenv("S3_BUCKET_NAME")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	region := os.Getenv("S3_REGION")

	if endpoint == "" || bucket == "" || accessKey == "" || secretKey == "" {
		s3Enabled = false
		return nil
	}

	u, err := url.Parse(endpoint)
	if err != nil {
		return err
	}
	secure := u.Scheme == "https"
	endp := u.Host
	if endp == "" {
		endp = strings.TrimPrefix(endpoint, "https://")
		endp = strings.TrimPrefix(endp, "http://")
	}

	cli, err := minio.New(endp, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: secure,
		Region: region,
	})
	if err != nil {
		return err
	}

	s3Client = cli
	s3Bucket = bucket
	s3Enabled = true

	ctx := context.Background()
	exists, err := s3Client.BucketExists(ctx, s3Bucket)
	if err != nil {
		return err
	}
	if !exists {
		if err := s3Client.MakeBucket(ctx, s3Bucket, minio.MakeBucketOptions{Region: region}); err != nil {
			return err
		}
	}
	return nil
}

func UploadReportObject(ctx context.Context, objectName string, reader io.Reader, size int64, contentType string) error {
	if !s3Enabled {
		return nil
	}
	_, err := s3Client.PutObject(ctx, s3Bucket, objectName, reader, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

func GetReportObject(ctx context.Context, objectName string) (io.ReadCloser, *minio.ObjectInfo, error) {
	if !s3Enabled {
		return nil, nil, os.ErrNotExist
	}
	obj, err := s3Client.GetObject(ctx, s3Bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, nil, err
	}
	info, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, nil, err
	}
	return obj, &info, nil
}

func DeleteReportObject(ctx context.Context, objectName string) error {
	if !s3Enabled {
		return nil
	}
	return s3Client.RemoveObject(ctx, s3Bucket, objectName, minio.RemoveObjectOptions{})
}
