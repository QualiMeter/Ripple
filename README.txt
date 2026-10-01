Изменённые файлы для обновления History под новый backend-контракт:

1. src/api/backend/types.ts
   - ChangeHistoryDto больше не содержит canUndo.

2. src/api/history.api.ts
   - canUndo вычисляется на frontend.
   - если backend не отметил current после отсутствия откатов, текущей считается самая свежая запись.
   - после отката isCurrent используется как курсор истории.
   - realtime больше не требует canUndo.

3. src/api/history.api.test.ts
   - тесты обновлены под новый контракт.
