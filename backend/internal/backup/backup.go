package backup

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

func StartScheduledBackups() {
	dir := getenv("BACKUP_DIR", filepath.Join("tmp", "db_backups"))
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("backup: cannot create backup dir %s: %v", dir, err)
		return
	}

	if isTruthy(getenv("BACKUP_RUN_ON_START", "")) {
		if err := performBackup(dir); err != nil {
			log.Printf("backup: immediate run failed: %v", err)
		} else {
			log.Printf("backup: immediate run succeeded")
		}
		rotateBackups(dir)
	}

	go func() {
		for {
			next := nextRunTime(getenv("BACKUP_DAILY_TIME", "03:15"))
			log.Printf("backup: next run at %s; dir=%s", next.Format(time.RFC3339), dir)
			sleepFor := time.Until(next)
			if sleepFor < 0 {
				sleepFor = 0
			}
			time.Sleep(sleepFor)
			if err := performBackup(dir); err != nil {
				log.Printf("backup: failed: %v", err)
			} else {
				log.Printf("backup: completed successfully")
			}
			rotateBackups(dir)
		}
	}()
}

func performBackup(backupDir string) error {
	dsn := os.Getenv("POSTGRES_DSN")
	if strings.TrimSpace(dsn) == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=crm_lite port=5432 sslmode=disable"
	}
	params, err := parseKeyValueDSN(dsn)
	if err != nil {
		return fmt.Errorf("parse DSN: %w", err)
	}

	host := firstNonEmpty(params["host"], "localhost")
	port := firstNonEmpty(params["port"], "5432")
	user := firstNonEmpty(params["user"], "postgres")
	password := params["password"]
	dbname := firstNonEmpty(params["dbname"], params["database"]) // support both keys
	if dbname == "" {
		dbname = "postgres"
	}

	pgDump := getenv("PG_DUMP_PATH", "pg_dump")
	pgDump = strings.Trim(pgDump, "\"")

	ts := time.Now().Format("20060102-150405")
	file := filepath.Join(backupDir, fmt.Sprintf("%s_%s.dump", dbname, ts))

	args := []string{"-h", host, "-p", port, "-U", user, "-d", dbname, "-F", "c", "-b", "-f", file}

	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()
	cmd := exec.CommandContext(ctx, pgDump, args...)
	if password != "" {
		cmd.Env = append(os.Environ(), "PGPASSWORD="+password)
	} else {
		cmd.Env = os.Environ()
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_dump error: %v; output: %s", err, string(out))
	}
	return nil
}

func rotateBackups(backupDir string) {
	maxFiles := mustAtoi(getenv("BACKUP_MAX_FILES", "30"), 30)
	retentionDays := mustAtoi(getenv("BACKUP_RETENTION_DAYS", "14"), 14)

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		log.Printf("backup: rotation read dir: %v", err)
		return
	}

	type fileInfo struct {
		name string
		path string
		mod  time.Time
	}
	var files []fileInfo
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(e.Name(), ".dump") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, fileInfo{name: e.Name(), path: filepath.Join(backupDir, e.Name()), mod: info.ModTime()})
	}

	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	for _, f := range files {
		if f.mod.Before(cutoff) {
			_ = os.Remove(f.path)
		}
	}

	files = nil
	entries, _ = os.ReadDir(backupDir)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".dump") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, fileInfo{name: e.Name(), path: filepath.Join(backupDir, e.Name()), mod: info.ModTime()})
	}
	if len(files) <= maxFiles {
		return
	}
	sort.Slice(files, func(i, j int) bool { return files[i].mod.After(files[j].mod) })
	for i := maxFiles; i < len(files); i++ {
		_ = os.Remove(files[i].path)
	}
}

func nextRunTime(hhmm string) time.Time {
	parts := strings.Split(hhmm, ":")
	if len(parts) != 2 {
		return time.Now().Add(24 * time.Hour)
	}
	h, _ := strconv.Atoi(parts[0])
	m, _ := strconv.Atoi(parts[1])
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), h, m, 0, 0, now.Location())
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}

func parseKeyValueDSN(dsn string) (map[string]string, error) {
	res := map[string]string{}
	fields := strings.Fields(dsn)
	if len(fields) == 0 {
		return nil, errors.New("empty DSN")
	}
	for _, f := range fields {
		kv := strings.SplitN(f, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val := strings.Trim(strings.TrimSpace(kv[1]), "\"")
		res[key] = val
	}
	return res, nil
}

func getenv(key, def string) string {
	v := os.Getenv(key)
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func mustAtoi(s string, def int) int {
	v, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return def
	}
	if v <= 0 {
		return def
	}
	return v
}

func isTruthy(s string) bool {
	s = strings.TrimSpace(strings.ToLower(s))
	return s == "1" || s == "true" || s == "yes" || s == "y"
}
