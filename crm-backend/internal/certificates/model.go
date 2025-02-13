package certificates

import "crm-backend/internal/db"

func GetAllCertificates() ([]db.Certificate, error) {
	var certificates []db.Certificate
	if err := db.DB.Find(&certificates).Error; err != nil {
		return nil, err
	}
	return certificates, nil
}

func CreateCertificate(filename string) error {
	certificate := db.Certificate{Filename: filename}
	if err := db.DB.Create(&certificate).Error; err != nil {
		return err
	}
	return nil
}

func DeleteCertificateByName(filename string) error {
	if err := db.DB.Where("filename = ?", filename).Delete(&db.Certificate{}).Error; err != nil {
		return err
	}
	return nil
}

func RenameCertificateInDB(oldName, newName string) error {
	if err := db.DB.Model(&db.Certificate{}).Where("filename = ?", oldName).Update("filename", newName).Error; err != nil {
		return err
	}
	return nil
}

func SearchCertificates(query string) ([]db.Certificate, error) {
	var certificates []db.Certificate
	if err := db.DB.Where("filename LIKE ?", "%"+query+"%").Find(&certificates).Error; err != nil {
		return nil, err
	}
	return certificates, nil
}
