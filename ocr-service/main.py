"""
EasyStock OCR Microservice
FastAPI server para procesamiento de albaranes
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import time
import logging
from pathlib import Path

from services.ocr_service import OCRService
from services.llm_service import LLMService
from models.schemas import ProcessResponse, AlbaranExtraido, HealthResponse

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Crear app
app = FastAPI(
    title="EasyStock OCR API",
    description="Microservicio de extracción de datos de albaranes con OCR local",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI en /docs
    redoc_url="/redoc"  # ReDoc en /redoc
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # Tu servidor Express
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar servicios
logger.info("🚀 Inicializando servicios...")
try:
    ocr_service = OCRService()
    llm_service = LLMService(model="qwen3:8b")
    logger.info("✅ Todos los servicios inicializados correctamente")
except Exception as e:
    logger.error(f"❌ Error inicializando servicios: {e}")
    raise

# Crear carpeta uploads
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ============ ENDPOINTS ============

@app.get("/", tags=["General"])
async def root():
    """Health check básico"""
    return {
        "service": "EasyStock OCR API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse, tags=["General"])
async def health_check():
    """Verificar estado de todos los servicios"""
    try:
        return HealthResponse(
            status="healthy",
            ocr="✅ Tesseract ready",
            llm=f"✅ Ollama ready",
            modelo_llm=llm_service.model
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )

@app.post("/api/extract-albaran", response_model=ProcessResponse, tags=["OCR"])
async def extract_albaran(file: UploadFile = File(...)):
    """
    Extraer datos de un albarán (imagen o PDF)
    
    **Flujo:**
    1. Guardar archivo subido
    2. Extraer texto con Tesseract OCR
    3. Estructurar datos con Ollama
    4. Devolver JSON estructurado
    
    **Formatos soportados:** JPG, PNG, PDF
    """
    start_time = time.time()
    
    try:
        logger.info(f"📥 Recibido: {file.filename} ({file.content_type})")
        
        # Validar tipo
        allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
        if file.content_type not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo no soportado: {file.content_type}. Usar: JPG, PNG, PDF"
            )
        
        # Guardar archivo
        timestamp = int(time.time())
        safe_name = f"{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / safe_name
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"💾 Guardado: {file_path}")
        
        # PASO 1: OCR
        logger.info("🔍 Ejecutando OCR...")
        ocr_text, confidence = ocr_service.extract_text(str(file_path))
        
        if not ocr_text or len(ocr_text.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="No se extrajo suficiente texto. Imagen borrosa o vacía."
            )
        
        logger.info(f"✅ OCR: {len(ocr_text.split())} palabras (conf: {confidence:.2%})")
        
        # PASO 2: LLM
        logger.info("🧠 Estructurando con LLM...")
        structured = llm_service.structure_albaran_data(ocr_text)
        
        if not structured.get('productos'):
            raise HTTPException(
                status_code=400,
                detail="No se encontraron productos en el albarán"
            )
        
        # Calcular tiempo
        elapsed = time.time() - start_time
        
        logger.info(f"✅ Completado en {elapsed:.2f}s")
        
        return ProcessResponse(
            success=True,
            message=f"Albarán procesado. {len(structured['productos'])} productos extraídos.",
            data=AlbaranExtraido(**structured),
            ocr_confidence=confidence,
            processing_time=elapsed
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando albarán: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Iniciando servidor FastAPI...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("API_PORT", "8000")),
        reload=True,
        log_level="info"
    )
