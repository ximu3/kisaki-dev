-- Synthetic KOReader data.
return {
["favorites"] = {
["settings"] = {
["order"] = 1
},
[1] = {
["file"] = "/old/books/pdf-book.pdf",
["order"] = 2
},
[2] = {
["file"] = "/old/books/novel.epub",
["order"] = 1
}
},
["旅途"] = {
["settings"] = {
["order"] = 2,
["default"] = true,
["folders"] = {
["/not-authorized"] = {
["subfolders"] = true
}
},
["filter"] = "unread"
},
[1] = {
["file"] = "/old/books/pdf-book.pdf",
["order"] = 2
},
[2] = {
["file"] = "/old/books/comic-book.cbz",
["order"] = 1
}
},
["按书名排列"] = {
["settings"] = {
["order"] = 3,
["collate"] = "strcoll"
},
[1] = {
["file"] = "/old/books/novel.epub"
}
}
}
