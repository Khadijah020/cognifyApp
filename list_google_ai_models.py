"""
Script to list all Google AI Studio models accessible with your API key.
"""

import google.generativeai as genai

# Configure with your API key
API_KEY = "AIzaSyBIjezVAhhGUw5JChksHxES4l6xqBiIQqg"  # Replace with your actual API key
genai.configure(api_key=API_KEY)

def list_all_models():
    """List all available models from Google AI Studio."""
    print("Fetching available Google AI models...\n")
    print("=" * 80)
    
    try:
        # Get all available models
        models = genai.list_models()
        
        model_count = 0
        for model in models:
            model_count += 1
            print(f"\nModel #{model_count}")
            print(f"  Name: {model.name}")
            print(f"  Display Name: {model.display_name}")
            print(f"  Description: {model.description}")
            
            # Show supported generation methods
            if hasattr(model, 'supported_generation_methods'):
                print(f"  Supported Methods: {', '.join(model.supported_generation_methods)}")
            
            # Show input/output token limits if available
            if hasattr(model, 'input_token_limit'):
                print(f"  Input Token Limit: {model.input_token_limit:,}")
            if hasattr(model, 'output_token_limit'):
                print(f"  Output Token Limit: {model.output_token_limit:,}")
            
            print("-" * 80)
        
        print(f"\n\nTotal models available: {model_count}")
        
        # Filter models that support generateContent
        print("\n" + "=" * 80)
        print("\nModels that support text generation (generateContent):")
        print("=" * 80)
        
        generation_models = [m for m in genai.list_models() 
                           if 'generateContent' in m.supported_generation_methods]
        
        for model in generation_models:
            print(f"  • {model.name}")
        
        # Filter models that support embedContent
        print("\n" + "=" * 80)
        print("\nModels that support embeddings (embedContent):")
        print("=" * 80)
        
        embedding_models = [m for m in genai.list_models() 
                          if 'embedContent' in m.supported_generation_methods]
        
        for model in embedding_models:
            print(f"  • {model.name}")
            
    except Exception as e:
        print(f"Error fetching models: {e}")
        print("\nMake sure:")
        print("1. You've replaced 'YOUR_API_KEY_HERE' with your actual API key")
        print("2. Your API key is valid and has the necessary permissions")
        print("3. You have the google-generativeai package installed")

if __name__ == "__main__":
    print("Google AI Studio - Available Models")
    print("=" * 80)
    list_all_models()
