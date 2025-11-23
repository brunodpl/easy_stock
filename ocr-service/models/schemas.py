"""
Modelos de datos para el sistema de extracción de albaranes
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class ProductoAlbaran(BaseModel):
    """Modelo para un producto individual del albarán"""
    codigo: Optional[str] = Field(None, description="Código del producto")
    descripcion: str = Field(..., description="Descripción del producto")
    cantidad: int = Field(..., ge=1, description="Cantidad (mínimo 1)")
    unidad: str = Field(..., description="Unidad de medida (Uds, Kg, L, etc.)")
    peso_volumen: Optional[str] = Field(None, description="Peso o volumen por unidad")
    lote: Optional[str] = Field(None, description="Número de lote")
    caducidad: Optional[str] = Field(None, description="Fecha de caducidad YYYY-MM-DD")
    
    class Config:
        json_schema_extra = {
            "example": {
                "codigo": "1001",
                "descripcion": "Leche Entera Pascual 1L",
                "cantidad": 48,
                "unidad": "Uds",
                "peso_volumen": "1L",
                "lote": "L240815",
                "caducidad": "2024-12-15"
            }
        }

class AlbaranExtraido(BaseModel):
    """Modelo para el albarán completo"""
    numero_albaran: Optional[str] = Field(None, description="Número del albarán")
    fecha: Optional[str] = Field(None, description="Fecha de entrega YYYY-MM-DD")
    proveedor: Optional[str] = Field(None, description="Nombre del proveedor")
    destinatario: Optional[str] = Field(None, description="Nombre del destinatario")
    productos: List[ProductoAlbaran] = Field(..., min_length=1, description="Lista de productos")
    observaciones: Optional[str] = Field(None, description="Observaciones adicionales")
    
    class Config:
        json_schema_extra = {
            "example": {
                "numero_albaran": "ALB-2024-001234",
                "fecha": "2024-11-20",
                "proveedor": "Distribuciones Alimentarias S.L.",
                "destinatario": "Supermercado La Despensa",
                "productos": [
                    {
                        "codigo": "1001",
                        "descripcion": "Leche Entera 1L",
                        "cantidad": 48,
                        "unidad": "Uds",
                        "lote": "L240815",
                        "caducidad": "2024-12-15"
                    }
                ],
                "observaciones": "Revisar temperatura productos refrigerados"
            }
        }

class ProcessResponse(BaseModel):
    """Respuesta del endpoint de procesamiento"""
    success: bool = Field(..., description="Si el procesamiento fue exitoso")
    message: str = Field(..., description="Mensaje descriptivo del resultado")
    data: Optional[AlbaranExtraido] = Field(None, description="Datos extraídos del albarán")
    ocr_confidence: Optional[float] = Field(None, ge=0, le=1, description="Confianza del OCR (0-1)")
    processing_time: float = Field(..., description="Tiempo de procesamiento en segundos")
    
class HealthResponse(BaseModel):
    """Respuesta del health check"""
    status: str
    ocr: str
    llm: str
    modelo_llm: str
