"""
Test completo del sistema OCR + LLM
"""
from services.ocr_service import OCRService
from services.llm_service import LLMService
import json

def main():
    print("=" * 70)
    print("🧪 TEST SISTEMA COMPLETO: Tesseract OCR + Ollama")
    print("=" * 70)
    
    try:
        # Inicializar
        print("\n📦 Inicializando servicios...")
        ocr = OCRService()
        llm = LLMService()
        
        # Simular texto de albarán
        print("\n📝 Texto simulado de albarán:")
        fake_text = """
        ALBARÁN DE ENTREGA
        Nº: ALB-2024-001234
        Fecha: 20/11/2024
        
        Proveedor: Distribuciones del Norte S.L.
        Destinatario: Supermercado La Despensa
        
        PRODUCTOS:
        1001 | Leche Entera Pascual 1L | 48 Uds | L240815 | 15/12/2024
        1002 | Yogur Natural Pack 8 | 24 Packs | L240820 | 28/11/2024
        3042 | Agua Mineral 1.5L | 30 Packs | L240901 | 01/09/2026
        """
        print(fake_text)
        
        # Procesar con LLM
        print("\n🧠 Procesando...")
        result = llm.structure_albaran_data(fake_text)
        
        # Mostrar resultado
        print("\n✅ RESULTADO JSON:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # Validar
        count = len(result.get('productos', []))
        print(f"\n📊 Productos extraídos: {count}")
        
        if count >= 3:
            print("\n🎉 ¡TEST EXITOSO!")
            return True
        else:
            print("\n⚠️ Se esperaban 3 productos")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    main()
