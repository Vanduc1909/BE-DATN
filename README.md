# Cách làm việc với github

## 1. Tách nhánh theo chức cần thiết từ nhánh phát triển (dev)

- Trước khi tách nhánh hỏi thành viên xem code mới nhất đang ở nhánh nào rồi dùng câu lệnh `git checkout (tên nhánh của code mới nhất)` và sử dụng câu lệnh `git pull` để lấy code mới nhất từ nhánh đó về
- Sử dụng câu lệnh ở trên nhánh có code mới nhất `git branch -M ten-nhanh`. (Tính năng mới thì sẽ đặt tên nhánh theo tên tính năng còn nếu fix lỗi thì sẽ có tiền tố là fix/ten-nhanh).

## 2. Gói code và đẩy code

- Sau khi code hoàn thiện chức năng hoặc 50%-70% thì đẩy code lên bằng các cách
- Bước 1: `git add .` để gói các file có sự thay đổi và chuẩn bị commit.
- Bước 2: `git commit -m "tin nhắn"` đẩy các file thay đổi lên theo tên commit.
- Bước 3: `git push origin ten-nhanh-hien-tai` để đẩy các commit lên nhánh mới của mình.
- Bước 4: sau khi đẩy nhánh thành công lên tạo pull request và không có conflict thì báo lại leader merge pull request.
