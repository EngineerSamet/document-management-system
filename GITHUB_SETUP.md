# GitHub'a Projeyi Yükleme Adımları

## 1. Git Kurulumu

Eğer Git kurulu değilse, [Git'in resmi sitesinden](https://git-scm.com/downloads) indirip kurabilirsiniz.

## 2. Git Başlatma

Proje klasöründe bir Git deposu başlatın:

```bash
git init
```

## 3. .gitignore Dosyalarının Kontrol Edilmesi

Backend ve frontend klasörlerindeki `.gitignore` dosyalarının doğru yapılandırıldığından emin olun. Özellikle `.env` dosyasının ve `node_modules` klasörlerinin yoksayıldığından emin olun.

## 4. .env Dosyalarının Güvenliği

`.env` dosyalarının GitHub'a yüklenmediğinden emin olun. Bunun yerine, `.env.example` dosyaları sağlayın.

## 5. Dosyaları Hazırlama ve Commit Etme

```bash
# Tüm dosyaları hazırlama alanına ekleyin
git add .

# İlk commit'i oluşturun
git commit -m "İlk commit: Belge Yönetim Sistemi"
```

## 6. GitHub'da Depo Oluşturma

1. [GitHub](https://github.com/) hesabınıza giriş yapın
2. Sağ üst köşedeki "+" simgesine tıklayın ve "New repository" seçin
3. Depo adı olarak "document-management-system" girin
4. Depo açıklaması ekleyin: "Belge Yönetim ve Onay Sistemi"
5. Depoyu "Public" olarak ayarlayın
6. "Create repository" düğmesine tıklayın

## 7. Yerel Depoyu GitHub'a Bağlama

GitHub'da oluşturduğunuz deponun URL'sini kullanarak yerel deponuzu uzak depoya bağlayın:

```bash
git remote add origin https://github.com/your-github-username/document-management-system.git
```

## 8. Değişiklikleri GitHub'a Gönderme

```bash
git push -u origin master
```

## 9. GitHub Sayfasını Kontrol Etme

GitHub'daki deponuzu ziyaret edin ve dosyaların başarıyla yüklendiğinden emin olun. README.md dosyasının düzgün görüntülendiğini kontrol edin.

## 10. Belgelendirme Bağlantılarını Kontrol Etme

README.md'deki belgelendirme bağlantılarının çalıştığından emin olun:
- Backend Dokümantasyonu: `backend/BACKEND-DOCUMENTATION.md`
- Frontend Dokümantasyonu: `frontend/FRONTEND-DOCUMENTATION.md`

## 11. Ekran Görüntüleri Ekleme

Projenizin ekran görüntülerini çekin ve bunları README.md dosyasındaki placeholder görüntülerin yerine ekleyin. Ekran görüntülerini bir `screenshots` klasörüne koyabilir ve bağlantıları güncelleyebilirsiniz.

```bash
# Ekran görüntülerini ekledikten sonra değişiklikleri commit edin
git add .
git commit -m "Ekran görüntüleri eklendi"
git push
```

## 12. Güvenlik Kontrolleri

Son olarak, GitHub'a yüklediğiniz kodda hassas bilgilerin (API anahtarları, şifreler, token'lar vb.) olmadığından emin olun. Gerekirse commit geçmişini kontrol edin ve hassas bilgileri içeren commit'leri düzeltin.

## 13. GitHub Profilini Güncelleme

GitHub profilinizde bu projeyi öne çıkarabilir ve README.md dosyasını daha da geliştirebilirsiniz. Projenin demo versiyonu varsa, bunu da ekleyebilirsiniz.
