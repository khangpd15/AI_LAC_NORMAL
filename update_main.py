with open('d:/REMICARE-STRABISMUS-AI/app/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

import_target = 'from app.api.transfer import router as transfer_router'
import_replacement = 'from app.api.transfer import router as transfer_router\nfrom app.api.cover_test_session import router as cover_test_session_router'

router_target = 'app.include_router(screening_router)\napp.include_router(transfer_router)'
router_replacement = 'app.include_router(screening_router)\napp.include_router(transfer_router)\napp.include_router(cover_test_session_router, prefix="/api/cover-test")\napp.include_router(cover_test_session_router, prefix="/api/v1/cover-test")'

if import_target in text and router_target in text:
    new_text = text.replace(import_target, import_replacement).replace(router_target, router_replacement)
    with open('d:/REMICARE-STRABISMUS-AI/app/main.py', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Updated app/main.py successfully')
else:
    print('Targets not found')
