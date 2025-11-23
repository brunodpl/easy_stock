"""
Servicio LLM usando Ollama
Estructura datos extraídos por OCR en formato JSON
"""
import os
import re
import ollama
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self, model: str = "qwen3:8b"):
        """
        Inicializar Ollama con modelo local
        
        Args:
            model: Nombre del modelo (qwen3:8b, gemma3:27b, etc.)
        """
        # Permitir override por variable de entorno
        self.model = os.getenv("OLLAMA_MODEL", model)
        host = os.getenv("OLLAMA_HOST")
        try:
            self.client = ollama.Client(host=host) if host else ollama.Client()
        except TypeError:
            # Compatibilidad con versiones antiguas del cliente
            self.client = ollama.Client()
        
        # Verificar que el modelo existe y Ollama está corriendo
        try:
            models = self.client.list()
            available = [m['name'] for m in models.get('models', [])]
            
            if not available:
                raise RuntimeError(
                    "No hay modelos de Ollama disponibles. "
                    "Ejecutar: ollama pull qwen3:8b"
                )
            
            if self.model not in available:
                logger.warning(f"⚠️ Modelo {self.model} no encontrado")
                logger.info(f"Modelos disponibles: {available}")
                self.model = available[0]
                logger.info(f"📌 Usando: {self.model}")
            else:
                logger.info(f"✅ Modelo cargado: {self.model}")
            
        except Exception as e:
            logger.error(f"❌ Error conectando con Ollama: {e}")
            raise RuntimeError(
                "No se puede conectar con Ollama. "
                "Asegúrate de que está corriendo: ollama serve"
            )
    
    def structure_albaran_data(self, ocr_text: str) -> Dict[str, Any]:
        """
        Estructurar datos del albarán usando LLM
        
        Args:
            ocr_text: Texto extraído por OCR
            
        Returns:
            Dict con datos estructurados del albarán
        """
        try:
            logger.info(f"🧠 Procesando con {self.model}...")
            
            prompt = self._build_extraction_prompt(ocr_text)
            
            # Llamar a Ollama
            response = self.client.generate(
                model=self.model,
                prompt=prompt,
                format='json',  # Forzar respuesta JSON
                options={
                    'temperature': 0.1,    # Más determinista
                    'num_predict': 2500,   # Tokens máximos
                    'top_p': 0.9
                }
            )
            
            result_text = response['response']
            
            # Intentar parsear JSON
            data = self._parse_json_response(result_text)
            
            productos_count = len(data.get('productos', []))
            logger.info(f"✅ Extraídos {productos_count} productos")
            
            return data
            
        except Exception as e:
            logger.error(f"❌ Error en LLM: {e}")
            raise
    
    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """Parsear respuesta JSON manejando casos edge"""
        # 1) Intento directo
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        
        # 2) Bloque ```json ... ```
        m = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if m:
            return json.loads(m.group(1))
        
        # 3) Bloque ``` ... ``` genérico
        m = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
        if m:
            return json.loads(m.group(1))
        
        # 4) Primer objeto JSON que aparezca
        m = re.search(r"(\{[\s\S]*\})", text)
        if m:
            return json.loads(m.group(1))
        
        raise ValueError("El modelo no devolvió JSON válido")
    
    def _build_extraction_prompt(self, ocr_text: str) -> str:
        """Construir prompt optimizado para extracción"""
        return f"""Eres un asistente experto en extraer información de albaranes de entrega españoles.

TAREA: Analiza el siguiente texto (extraído con OCR de un albarán) y estructura TODA la información en formato JSON válido.

FORMATO JSON REQUERIDO:
{{
  "numero_albaran": "ALB-2024-001234",
  "fecha": "2024-11-20",
  "proveedor": "Nombre empresa proveedora",
  "destinatario": "Nombre destinatario",
  "productos": [
    {{
      "codigo": "1001",
      "descripcion": "Nombre completo del producto",
      "cantidad": 48,
      "unidad": "Uds",
      "peso_volumen": "1L",
      "lote": "L240815",
      "caducidad": "2024-12-15"
    }}
  ],
  "observaciones": "Notas adicionales si existen"
}}

REGLAS CRÍTICAS:
1. Extrae TODOS los productos que encuentres
2. Fechas SIEMPRE en formato YYYY-MM-DD
3. Si un campo no existe, usa null (no cadena vacía)
4. Cantidades como números enteros sin comillas
5. No inventes datos - si no está, pon null
6. Responde SOLO con el JSON, sin explicaciones

TEXTO DEL ALBARÁN:
{ocr_text}

JSON:"""
