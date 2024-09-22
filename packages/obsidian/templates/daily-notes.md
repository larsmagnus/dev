---
created: <% tp.file.creation_date() %>
tags:
  - daily
---

# <% moment(tp.file.title,'DD.MM.YYYY').format("dddd, MMMM DD, YYYY") %> - [[weekly/<% moment(tp.file.title,'DD.MM.YYYY').format("YYYY-[W]ww") %>|Week <% moment(tp.file.title,'DD.MM.YYYY').format("ww") %>]]

- [[<% fileDate = moment(tp.file.title, 'DD.MM.YYYY').subtract(1, 'days').format('DD.MM.YYYY') %>|⬅️ Yesterday]] | [[<% fileDate = moment(tp.file.title, 'DD.MM.YYYY').add(1, 'days').format('DD.MM.YYYY') %>|Tomorrow ➡️]]
- [[excalidraw/<% tp.date.now("HHmm")+' '+tp.file.title %>|Drawing]]

---

## Daily

### 💭 Notes

-

#### 🚀 Focus

- [ ]

---

## Birthdays

```dataview
List dateformat(date(file.frontmatter.birthday), "d MMMM")
WHERE contains(tags, "person") AND date(file.frontmatter.birthday).month = date(today).month
SORT date(file.frontmatter.birthday).day ASC, date(file.frontmatter.birthday).month ASC
LIMIT 20
```

## Favorites

```dataview
List dateformat(file.mtime, "dd LLL yy – hh:mm a")
WHERE contains(tags, "favorite")
SORT file.mtime DESC
LIMIT 10
```

---

### Recent notes

```dataview
List dateformat(file.mtime, "dd LLL yy – hh:mm a")
WHERE file.mtime
SORT file.mtime DESC
LIMIT 10
```
