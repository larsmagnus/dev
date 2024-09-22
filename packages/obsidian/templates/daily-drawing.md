---
created: <% tp.file.creation_date() %>
tags:
  - excalidraw
---

# Drawing for [[daily/<% tp.date.now("DD.MM.YYYY") %>|<% moment(tp.file.title,'DD.MM.YYYY').format("dddd, MMMM DD, YYYY") %>]]

<%\* const title = tp.date.now("HHmm")+' '+tp.file.title; const ea = ExcalidrawAutomate; ea.reset(); await ea.create({filename : title,onNewPane : false}); %>
![[excalidraw/<% tp.date.now("HHmm")+' '+tp.file.title %>.excalidraw]]
