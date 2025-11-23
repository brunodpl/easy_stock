"""
Servicio OCR usando Tesseract
Extrae texto de imágenes de albaranes
"""
import pytesseract
import logging
from typing import Tuple
from pathlib import Path
from utils.image_utils import enhance_image_for_ocr, resize_if_too_large

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self, tesseract_path: str = r'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'):
        """
        Inicializar servicio Tesseract OCR
        
        Args:
            tesseract_path: Ruta al ejecutable de Tesseract en Windows
        """
        # Configurar ruta de Tesseract (necesario en Windows)
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        
        # Verificar que funciona
        try:
            version = pytesseract.get_tesseract_version()
            logger.info(f"✅ Tesseract OCR v{version} inicializado")
        except Exception as e:
            logger.error(f"❌ Error inicializando Tesseract: {e}")
            raise RuntimeError(
                "Tesseract no encontrado. Instalar desde: "
                "https://github.com/UB-Mannheim/tesseract/wiki"
            )
    
    def extract_text(self, image_path: str) -> Tuple[str, float]:
        """
        Extraer texto de imagen usando Tesseract OCR
        
        Args:
            image_path: Ruta a la imagen del albarán
            
        Returns:
            Tuple[str, float]: (texto_completo, confianza_promedio)
        """
        try:
            logger.info(f"🔍 Extrayendo texto de: {image_path}")
            
            # Pre-procesamiento
            resized_path = resize_if_too_large(image_path)
            processed_path = enhance_image_for_ocr(resized_path)
            
            # Configuración para español
            # PSM 6 = Asume un bloque uniforme de texto
            config = '--lang spa --psm 6'
            
            # Extraer texto
            text = pytesseract.image_to_string(processed_path, config=config)
            
            # Obtener confianza detallada
            data = pytesseract.image_to_data(
                processed_path,
                config=config,
                output_type=pytesseract.Output.DICT
            )
            
            # Calcular confianza promedio (solo palabras con confianza > 0)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0
            
            # Limpiar texto
            text = text.strip()
            
            logger.info(f"✅ Extraídas {len(text.split())} palabras (confianza: {avg_confidence:.2%})")
            
            return text, avg_confidence
            
        except Exception as e:
            logger.error(f"❌ Error en OCR: {e}")
            raise
