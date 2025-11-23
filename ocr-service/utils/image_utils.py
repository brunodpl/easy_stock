"""
Utilidades para procesamiento de imágenes
Mejora la calidad antes del OCR
"""
import cv2
import numpy as np
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def enhance_image_for_ocr(image_path: str) -> str:
    """
    Mejorar imagen para optimizar OCR
    
    Aplica:
    - Conversión a escala de grises
    - Mejora de contraste (CLAHE)
    - Reducción de ruido
    - Binarización adaptativa
    
    Args:
        image_path: Ruta a la imagen original
        
    Returns:
        Ruta a la imagen procesada
    """
    try:
        # Leer imagen
        img = cv2.imread(image_path)
        
        if img is None:
            raise ValueError(f"No se pudo leer la imagen: {image_path}")
        
        # 1. Convertir a escala de grises
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 2. Mejorar contraste con CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # 3. Reducir ruido
        denoised = cv2.fastNlMeansDenoising(enhanced, h=10)
        
        # 4. Binarización adaptativa (mejor para documentos)
        binary = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2
        )
        
        # Guardar imagen procesada
        path_obj = Path(image_path)
        processed_path = str(path_obj.parent / f"{path_obj.stem}_processed{path_obj.suffix}")
        cv2.imwrite(processed_path, binary)
        
        logger.info(f"✅ Imagen mejorada: {processed_path}")
        return processed_path
        
    except Exception as e:
        logger.warning(f"⚠️ Error mejorando imagen: {e}. Usando original.")
        return image_path

def resize_if_too_large(image_path: str, max_width: int = 2000) -> str:
    """
    Redimensionar imagen si es muy grande (mejora velocidad)
    
    Args:
        image_path: Ruta a la imagen
        max_width: Ancho máximo en píxeles
        
    Returns:
        Ruta a la imagen (redimensionada si era necesario)
    """
    try:
        img = cv2.imread(image_path)
        height, width = img.shape[:2]
        
        if width > max_width:
            ratio = max_width / width
            new_width = max_width
            new_height = int(height * ratio)
            
            resized = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
            
            path_obj = Path(image_path)
            resized_path = str(path_obj.parent / f"{path_obj.stem}_resized{path_obj.suffix}")
            cv2.imwrite(resized_path, resized)
            
            logger.info(f"📏 Imagen redimensionada de {width}x{height} a {new_width}x{new_height}")
            return resized_path
        
        return image_path
        
    except Exception as e:
        logger.warning(f"⚠️ Error redimensionando: {e}")
        return image_path
