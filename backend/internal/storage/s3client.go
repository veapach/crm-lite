package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
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

// UploadReportObject загружает объект в S3 (для отчетов, превью)
func UploadReportObject(ctx context.Context, objectName string, reader io.Reader, size int64, contentType string) error {
	if !s3Enabled {
		return nil
	}
	_, err := s3Client.PutObject(ctx, s3Bucket, objectName, reader, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

// GetReportObject получает объект из S3
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

// DeleteReportObject удаляет объект из S3
func DeleteReportObject(ctx context.Context, objectName string) error {
	if !s3Enabled {
		return nil
	}
	return s3Client.RemoveObject(ctx, s3Bucket, objectName, minio.RemoveObjectOptions{})
}

// UploadObject - универсальный метод загрузки в S3 с указанием prefix (files/, tickets/, etc.)
func UploadObject(ctx context.Context, prefix, filename string, reader io.Reader, size int64, contentType string) error {
	if !s3Enabled {
		return nil
	}
	objectName := prefix + filename
	_, err := s3Client.PutObject(ctx, s3Bucket, objectName, reader, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

// GetObject - универсальный метод получения объекта из S3
func GetObject(ctx context.Context, prefix, filename string) (io.ReadCloser, *minio.ObjectInfo, error) {
	if !s3Enabled {
		return nil, nil, os.ErrNotExist
	}
	objectName := prefix + filename
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

// DeleteObject - универсальный метод удаления объекта из S3
func DeleteObject(ctx context.Context, prefix, filename string) error {
	if !s3Enabled {
		return nil
	}
	objectName := prefix + filename
	return s3Client.RemoveObject(ctx, s3Bucket, objectName, minio.RemoveObjectOptions{})
}

// ObjectExists проверяет существование объекта в S3
func ObjectExists(ctx context.Context, prefix, filename string) bool {
	if !s3Enabled {
		return false
	}
	objectName := prefix + filename
	_, err := s3Client.StatObject(ctx, s3Bucket, objectName, minio.StatObjectOptions{})
	return err == nil
}

// GetUniqueFileName возвращает уникальное имя файла для S3 (добавляет (1), (2) и т.д.)
func GetUniqueFileName(ctx context.Context, prefix, baseName string) string {
	if !s3Enabled {
		return baseName
	}
	ext := filepath.Ext(baseName)
	name := strings.TrimSuffix(baseName, ext)
	newName := baseName
	counter := 1

	for {
		if !ObjectExists(ctx, prefix, newName) {
			return newName
		}
		newName = fmt.Sprintf("%s(%d)%s", name, counter, ext)
		counter++
	}
}

// CopyObject копирует объект в S3 (для переименования)
func CopyObject(ctx context.Context, srcPrefix, srcFilename, dstPrefix, dstFilename string) error {
	if !s3Enabled {
		return nil
	}
	srcOpts := minio.CopySrcOptions{
		Bucket: s3Bucket,
		Object: srcPrefix + srcFilename,
	}
	dstOpts := minio.CopyDestOptions{
		Bucket: s3Bucket,
		Object: dstPrefix + dstFilename,
	}
	_, err := s3Client.CopyObject(ctx, dstOpts, srcOpts)
	return err
}
